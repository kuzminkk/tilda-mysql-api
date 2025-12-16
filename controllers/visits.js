import mysql from "mysql2/promise";
import { dbConfig } from "../config/database.js";

// --------------------------------------------
// ЭНДПОИНТ 2: ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ВИЗИТАХ ПАЦИЕНТА
// --------------------------------------------
// GET /get-visit-info — получение детальной информации по визитам конкретного пациента
export const getVisitInfo = async (req, res) => {
  // Извлечение параметров из query string запроса
  const { lastname, firstname, patronymic, api_key } = req.query;

  console.log('=== GET-VISIT-INFO ЗАПРОС ===');
  console.log('Параметры:', { lastname, firstname, patronymic });

  // Проверка авторизации через API ключ
  if (process.env.API_KEY && api_key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const conn = await mysql.createConnection(dbConfig);

  try {
    // SQL запрос с JOIN нескольких таблиц для получения полной информации о визитах
    const [rows] = await conn.execute(
      `
      SELECT 
        vst.vst_id,
        CONCAT(ptt.ptt_sername, ' ', ptt.ptt_name, ' ', IFNULL(ptt.ptt_patronymic, '')) AS ФИО_пациента,
        vst.vst_date AS Дата_визита,
        vst.vst_timestrart AS Начало_визита,
        vst.vst_timeend AS Конец_визита,
        CONCAT(emp.ele_sername, ' ', emp.ele_name, ' ', IFNULL(emp.ele_patronymic, '')) AS ФИО_врача,
        emp.ele_id,
        ds.dse_id,
        ds.dse_name AS Наименование_услуги,
        vds.vds_quantity AS Количество_услуг,
        ds.dse_price AS Цена_услуги,
        vds.vds_total_amount AS Сумма_за_услугу,
        vst.vst_discount AS Скидка_на_визит,
        vst.vst_final_sumservice AS Итоговая_сумма_визита,
        COALESCE(pv.pvt_payment, 0) AS Итоговая_сумма_оплаты_визита,
        COALESCE(pm.pmd_name, 'не оплачено') AS Способ_оплаты_визита,
        vst.vst_note AS Комментарий_к_визиту,
        vss.vss_type AS Статус_визита,
        vte.vte_type AS Тип_визита
      FROM Visits vst
      JOIN Patients ptt ON vst.ptt_id_FK = ptt.ptt_id
      JOIN Employees emp ON vst.ele_id_FK = emp.ele_id
      JOIN Visit_Statuses vss ON vst.vss_id_FK = vss.vss_id
      JOIN Visit_Types vte ON vst.vte_id_FK = vte.vte_id
      LEFT JOIN Visit_Dental_Services vds ON vst.vst_id = vds.vst_id_FK
      LEFT JOIN Dental_Services ds ON vds.dse_id_FK = ds.dse_id
      LEFT JOIN Paymet_Visits pv ON vst.vst_id = pv.vst_id_FK
      LEFT JOIN Payment_Methods pm ON pv.pmd_id_FK = pm.pmd_id
      WHERE ptt.ptt_sername = ? 
        AND ptt.ptt_name = ?
        AND (ptt.ptt_patronymic = ? OR ? IS NULL OR ptt.ptt_patronymic IS NULL)
      ORDER BY vst.vst_date DESC, vst.vst_timestrart DESC
      `,
      [lastname, firstname, patronymic || null, patronymic || null]
    );
    // Консольный вывод для логгирования на сервере
    console.log(`Найдено записей в БД: ${rows.length}`);
    
    // Группируем данные и преобразуем в иерархическую структуру для удобства вывода и анализа данных
    const visitsMap = {};
    rows.forEach(row => {
      if (!visitsMap[row.vst_id]) {
        visitsMap[row.vst_id] = {
          visitId: row.vst_id,
          date: row.Дата_визита,
          startTime: row.Начало_визита,
          endTime: row.Конец_визита,
          doctor: row.ФИО_врача,
          doctorId: row.ele_id,
          status: row.Статус_визита,
          visitType: row.Тип_визита,
          comment: row.Комментарий_к_визиту,
          discount: row.Скидка_на_визит,
          totalAmount: row.Итоговая_сумма_визита,
          paymentAmount: row.Итоговая_сумма_оплаты_визита,
          paymentMethod: row.Способ_оплаты_визита,
          services: []
        };
      }
      if (row.dse_id) {
        visitsMap[row.vst_id].services.push({
          dse_id: row.dse_id,
          name: row.Наименование_услуги,
          quantity: row.Количество_услуг || 1,
          discount: row.Скидка_на_услугу || 0,
          price: row.Цена_услуги || 0,
          total: row.Сумма_за_услугу || 0
        });
      }
    });

    // Консольный вывод для логгирования на сервере
    console.log('Группировка по визитам:');
    Object.values(visitsMap).forEach(visit => {
      console.log(`Визит ${visit.visitId}: ${visit.services.length} услуг, оплата: ${visit.paymentAmount} (${visit.paymentMethod})`);
    });

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error("Ошибка в /get-visit-info:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};

// --------------------------------------------
// ЭНДПОИНТ 10: СОХРАНЕНИЕ ВИЗИТА
// --------------------------------------------
// POST /save-visit — создание или редактирование визита пациента
export const saveVisit = async (req, res) => {
  if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Извлекаем данные из тела запроса
  const { patientId, date, startTime, endTime, doctorId, discount, services, products, finalAmount, visitId } = req.body;
  
  // Консольный вывод для логгирования на сервере
  console.log('--- НАЧАЛО СОХРАНЕНИЯ ВИЗИТА ---');
  console.log('Данные:', { 
    visitId, 
    servicesCount: services?.length,
    productsCount: products?.length 
  });

  const conn = await mysql.createConnection(dbConfig);

  try {
    await conn.beginTransaction();

    // ДИАГНОСТИКА: Проверим текущее состояние визита ДО изменений
    if (visitId) {
      console.log('Проверяем текущие данные визита...');
      const [currentServices] = await conn.execute(
        `SELECT vds_id, dse_id_FK, vds_quantity FROM Visit_Dental_Services WHERE vst_id_FK = ?`,
        [visitId]
      );
      console.log(`Текущие услуги визита ${visitId}:`, currentServices);

      // Проверяем текущие товары визита (если таблица существует)
      try {
        const [currentProducts] = await conn.execute(
          `SELECT id, product_id, quantity FROM Visit_Products WHERE visit_id = ?`,
          [visitId]
        );
        console.log(`Текущие товары визита ${visitId}:`, currentProducts);
      } catch (err) {
        console.log('Таблица Visit_Products еще не создана, пропускаем проверку товаров');
      }
    }

    let visitIdToUse;

    // Если передан visitId - редактируем существующий визит
    if (visitId && !isNaN(parseInt(visitId))) {
      console.log('РЕДАКТИРОВАНИЕ визита ID:', visitId);
      
      // УДАЛЕНИЕ старых услуг
      console.log('УДАЛЕНИЕ старых услуг...');
      const [deleteBefore] = await conn.execute(
        `SELECT COUNT(*) as count_before FROM Visit_Dental_Services WHERE vst_id_FK = ?`,
        [visitId]
      );
      console.log(`Услуг до удаления: ${deleteBefore[0].count_before}`);

      const [deleteResult] = await conn.execute(
        `DELETE FROM Visit_Dental_Services WHERE vst_id_FK = ?`,
        [visitId]
      );
      console.log(`Удалено услуг: ${deleteResult.affectedRows}`);

      // УДАЛЕНИЕ старых товаров (если таблица существует)
      let deletedProductsCount = 0;
      try {
        // Сначала получаем старые товары для восстановления остатков
        const [oldProducts] = await conn.execute(
          `SELECT product_id, quantity FROM Visit_Products WHERE visit_id = ?`,
          [visitId]
        );
        
        // Восстанавливаем остатки на складе для старых товаров
        for (const oldProduct of oldProducts) {
          await conn.execute(
            `UPDATE ERP_Unit_In_Storage SET Amount = Amount + ? WHERE Unit_id = ?`,
            [oldProduct.quantity, oldProduct.product_id]
          );
          console.log(`Восстановлен товар ${oldProduct.product_id}: +${oldProduct.quantity} шт.`);
        }

        // Удаляем старые товары визита
        const [deleteProductsResult] = await conn.execute(
          `DELETE FROM Visit_Products WHERE visit_id = ?`,
          [visitId]
        );
        deletedProductsCount = deleteProductsResult.affectedRows;
        console.log(`Удалено товаров: ${deletedProductsCount}`);
      } catch (err) {
        console.log('Таблица Visit_Products еще не создана, пропускаем удаление товаров');
      }

      // Обновляем визит
      console.log('Обновление данных визита...');
      const [updateResult] = await conn.execute(
        `UPDATE Visits SET 
          vst_date = ?, vst_timestrart = ?, vst_timeend = ?, 
          ele_id_FK = ?, vst_discount = ?, vst_final_sumservice = ?
         WHERE vst_id = ?`,
        [date, startTime, endTime, doctorId, discount || 0, finalAmount || 0, visitId]
      );
      
      visitIdToUse = visitId;
      console.log('Визит обновлен');

    } else {
      // Иначе создаем новый визит
      console.log('СОЗДАНИЕ нового визита');
      const [visitResult] = await conn.execute(
        `INSERT INTO Visits (
          ptt_id_FK, ele_id_FK, vst_date, vst_timestrart, vst_timeend,
          vte_id_FK, vss_id_FK, vst_discount, vst_final_sumservice
        ) VALUES (?, ?, ?, ?, ?, 1, 2, ?, ?)`,
        [patientId, doctorId, date, startTime, endTime, discount || 0, finalAmount || 0]
      );
      visitIdToUse = visitResult.insertId;
      console.log('Создан визит ID:', visitIdToUse);
    }

    // ДОБАВЛЕНИЕ УСЛУГ
    console.log('Добавление услуг:', services?.length || 0);
    if (services && services.length > 0) {
      for (const service of services) {
        console.log(`Услуга: ${service.serviceId || service.id}, количество: ${service.quantity}`);
        
        const serviceId = service.serviceId || service.id;
        const serviceQuantity = service.quantity || 1;
        const serviceTotal = service.total || (service.price * serviceQuantity);
        
        const [serviceResult] = await conn.execute(
          `INSERT INTO Visit_Dental_Services (
            vst_id_FK, dse_id_FK, vds_quantity, vds_discount, vds_total_amount
          ) VALUES (?, ?, ?, 0, ?)`,
          [visitIdToUse, serviceId, serviceQuantity, serviceTotal]
        );
        console.log(`Добавлена услуга ID: ${serviceResult.insertId}`);
      }
    } else {
      console.log('Услуги не указаны');
    }

    // ДОБАВЛЕНИЕ ТОВАРОВ
    console.log('Добавление товаров:', products?.length || 0);
    if (products && products.length > 0) {
      try {
        for (const product of products) {
          console.log(`Товар: ${product.id}, количество: ${product.quantity}`);
          
          // Проверяем доступное количество
          const [productCheck] = await conn.execute(
            `SELECT Amount, Name FROM ERP_Unit_In_Storage WHERE Unit_id = ?`,
            [product.id]
          );
          
          if (productCheck.length === 0) {
            throw new Error(`Товар с ID ${product.id} не найден`);
          }
          
          const availableQuantity = productCheck[0].Amount;
          const productName = productCheck[0].Name;
          
          if (availableQuantity < product.quantity) {
            throw new Error(`Недостаточно товара "${productName}". Доступно: ${availableQuantity}, требуется: ${product.quantity}`);
          }
          
          // Добавляем товар в визит
          const [productResult] = await conn.execute(
            `INSERT INTO Visit_Products (visit_id, product_id, quantity) VALUES (?, ?, ?)`,
            [visitIdToUse, product.id, product.quantity]
          );
          
          // Обновляем количество на складе
          await conn.execute(
            `UPDATE ERP_Unit_In_Storage SET Amount = Amount - ? WHERE Unit_id = ?`,
            [product.quantity, product.id]
          );
          
          console.log(`Добавлен товар ID: ${productResult.insertId}, списано со склада: ${product.quantity} шт.`);
        }
      } catch (err) {
        // Если таблица Visit_Products не существует, создаем ее
        if (err.code === 'ER_NO_SUCH_TABLE') {
          console.log('Создаем таблицу Visit_Products...');
          
          await conn.execute(`
            CREATE TABLE Visit_Products (
              id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
              visit_id INT NOT NULL,
              product_id INT NOT NULL,
              quantity INT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (visit_id) REFERENCES Visits(vst_id),
              FOREIGN KEY (product_id) REFERENCES ERP_Unit_In_Storage(Unit_id)
            )
          `);
          console.log('Таблица Visit_Products создана');
          
          // Повторяем добавление товаров после создания таблицы
          for (const product of products) {
            const [productResult] = await conn.execute(
              `INSERT INTO Visit_Products (visit_id, product_id, quantity) VALUES (?, ?, ?)`,
              [visitIdToUse, product.id, product.quantity]
            );
            
            await conn.execute(
              `UPDATE ERP_Unit_In_Storage SET Amount = Amount - ? WHERE Unit_id = ?`,
              [product.quantity, product.id]
            );
            
            console.log(`Добавлен товар ID: ${productResult.insertId}`);
          }
        } else {
          throw err;
        }
      }
    } else {
      console.log('Товары не указаны');
    }

    // ФИНАЛЬНАЯ ПРОВЕРКА
    console.log('ФИНАЛЬНАЯ ПРОВЕРКА...');
    
    // Проверяем услуги
    const [finalServices] = await conn.execute(
      `SELECT vds_id, dse_id_FK, vds_quantity FROM Visit_Dental_Services WHERE vst_id_FK = ?`,
      [visitIdToUse]
    );
    console.log(`Итоговые услуги визита ${visitIdToUse}:`, finalServices);

    // Проверяем товары
    let finalProducts = [];
    try {
      const [productsCheck] = await conn.execute(
        `SELECT id, product_id, quantity FROM Visit_Products WHERE visit_id = ?`,
        [visitIdToUse]
      );
      finalProducts = productsCheck;
      console.log(`Итоговые товары визита ${visitIdToUse}:`, finalProducts);
    } catch (err) {
      console.log('Таблица Visit_Products не доступна для проверки');
    }

    await conn.commit();
    console.log('ТРАНЗАКЦИЯ УСПЕШНА');
    
    res.status(200).json({ 
      status: "success", 
      message: "Визит успешно сохранен",
      visitId: visitIdToUse,
      finalServicesCount: finalServices.length,
      finalProductsCount: finalProducts.length
    });
    
  } catch (err) {
    await conn.rollback();
    console.error("ОШИБКА:", err);
    res.status(500).json({ 
      error: "Ошибка сервера", 
      detail: err.message
    });
  } finally {
    await conn.end();
  }
};

// --------------------------------------------
// ЭНДПОИНТ 13: ОЧИСТКА ДУБЛИКАТОВ УСЛУГ
// --------------------------------------------
// POST /cleanup-duplicates — удаление дублирующихся услуг в визите
export const cleanupDuplicates = async (req, res) => {
  if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { visitId } = req.body;
  const conn = await mysql.createConnection(dbConfig);

  try {
    await conn.beginTransaction();

    console.log('ОЧИСТКА ДУБЛИКАТОВ для визита:', visitId);

    // Находим дубликаты (услуги с одинаковым ID и количеством)
    const [duplicates] = await conn.execute(
      `SELECT vds_id, dse_id_FK, vds_quantity, COUNT(*) as count
       FROM Visit_Dental_Services 
       WHERE vst_id_FK = ? 
       GROUP BY dse_id_FK, vds_quantity 
       HAVING COUNT(*) > 1`,
      [visitId]
    );

    console.log('Найдено дубликатов:', duplicates.length);

    let totalDeleted = 0;

    if (duplicates.length > 0) {
      // Оставляем только первую запись для каждой комбинации услуга+количество
      for (const dup of duplicates) {
        const [toDelete] = await conn.execute(
          `DELETE FROM Visit_Dental_Services 
           WHERE vst_id_FK = ? AND dse_id_FK = ? AND vds_quantity = ?
           AND vds_id != (
             SELECT min_id FROM (
               SELECT MIN(vds_id) as min_id 
               FROM Visit_Dental_Services 
               WHERE vst_id_FK = ? AND dse_id_FK = ? AND vds_quantity = ?
             ) as temp
           )`,
          [visitId, dup.dse_id_FK, dup.vds_quantity, visitId, dup.dse_id_FK, dup.vds_quantity]
        );
        console.log(`Удалено дубликатов для услуги ${dup.dse_id_FK}: ${toDelete.affectedRows}`);
        totalDeleted += toDelete.affectedRows;
      }
    }

    await conn.commit();

    // Проверяем результат
    const [finalServices] = await conn.execute(
      `SELECT vds_id, dse_id_FK, vds_quantity FROM Visit_Dental_Services WHERE vst_id_FK = ?`,
      [visitId]
    );

    console.log(`Осталось услуг после очистки: ${finalServices.length}`);

    res.status(200).json({
      status: "success",
      message: "Дубликаты очищены",
      deletedCount: totalDeleted,
      remainingServices: finalServices.length,
      services: finalServices
    });

  } catch (err) {
    await conn.rollback();
    console.error("Ошибка очистки дубликатов:", err);
    res.status(500).json({ 
      error: "Ошибка очистки дубликатов", 
      detail: err.message 
    });
  } finally {
    await conn.end();
  }
};
