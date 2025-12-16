import mysql from "mysql2/promise";
import { dbConfig } from "../config/database.js";

// --------------------------------------------
// ЭНДПОИНТ 11: ОБРАБОТКА ОПЛАТЫ
// --------------------------------------------
// POST /process-payment — обработка оплаты визита
export const processPayment = async (req, res) => {
  const { visitId, paymentMethod, amount } = req.body;
  
  console.log('--- ОБРАБОТКА ОПЛАТЫ ---');
  console.log('Данные:', { visitId, paymentMethod, amount });

  if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Валидация входных данных
  if (!visitId || !paymentMethod || !amount) {
    return res.status(400).json({ error: "Не все обязательные поля заполнены" });
  }

  const conn = await mysql.createConnection(dbConfig);

  try {
    await conn.beginTransaction();

    // Проверяем существование визита
    const [visitCheck] = await conn.execute(
      `SELECT vst_id FROM Visits WHERE vst_id = ?`,
      [visitId]
    );
    
    if (visitCheck.length === 0) {
      throw new Error(`Визит с ID ${visitId} не найден`);
    }

    console.log('Визит найден, продолжаем оплату...');

    // Создаем квитанцию об оплате
    const [receiptResult] = await conn.execute(
      `INSERT INTO Payment_Receipts (prt_date_creation) VALUES (CURDATE())`
    );
    const receiptId = receiptResult.insertId;
    console.log('Создана квитанция ID:', receiptId);

    // Добавляем запись об оплате
    const [paymentResult] = await conn.execute(
      `INSERT INTO Paymet_Visits (pvt_payment, pmd_id_FK, vst_id_FK) VALUES (?, ?, ?)`,
      [amount, paymentMethod, visitId]
    );
    console.log('Добавлена запись об оплате ID:', paymentResult.insertId);

    // Обновляем визит - добавляем ссылку на квитанцию
    const [updateResult] = await conn.execute(
      `UPDATE Visits SET prt_id_FK = ? WHERE vst_id = ?`,
      [receiptId, visitId]
    );
    console.log('Визит обновлен, affected rows:', updateResult.affectedRows);

    await conn.commit();
    console.log('ОПЛАТА УСПЕШНО ОБРАБОТАНА');
    
    res.status(200).json({ 
      status: "success", 
      message: "Оплата успешно обработана",
      receiptId: receiptId,
      paymentId: paymentResult.insertId
    });
    
  } catch (err) {
    await conn.rollback();
    console.error("ОШИБКА ОПЛАТЫ:", err);
    res.status(500).json({ 
      error: "Ошибка сервера при обработке оплаты", 
      detail: err.message 
    });
  } finally {
    await conn.end();
  }
};
