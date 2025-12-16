import mysql from "mysql2/promise";
import { dbConfig } from "../config/database.js";

// --------------------------------------------
// ЭНДПОИНТ 4: ДОБАВЛЕНИЕ СОТРУДНИКА
// --------------------------------------------
// POST /add-employee — добавление нового сотрудника
export const addEmployee = async (req, res) => {
  const data = req.body;
  const conn = await mysql.createConnection(dbConfig);

  try {
    await conn.beginTransaction();

    // Определяем ID должности по названию
    let positionId;
    const [positionRows] = await conn.execute(
      `SELECT psn_id FROM Positions WHERE psn_name = ?`,
      [data.position]
    );

    if (positionRows.length > 0) {
      positionId = positionRows[0].psn_id;
    } else {
      // Если должности нет - создаём новую
      const [newPosition] = await conn.execute(
        `INSERT INTO Positions (psn_name) VALUES (?)`,
        [data.position]
      );
      positionId = newPosition.insertId;
    }

    // Определяем статус сотрудника (уволен или активен)
    const employeeStatus = data.dismissed ? 1 : 2; // 1 - неактивен, 2 - активен

    // Преобразуем дату рождения из формата дд.мм.гггг в гггг-мм-дд
    let formattedBirthdate = null;
    if (data.birthdate) {
      const [day, month, year] = data.birthdate.split('.');
      formattedBirthdate = `${year}-${month}-${day}`;
    }

    // Преобразуем СНИЛС - убираем форматирование (только цифры)
    const cleanSnils = data.snils ? data.snils.replace(/\D/g, '') : null;

    // Добавляем сотрудника в основную таблицу
    const [employeeResult] = await conn.execute(
      `
      INSERT INTO Employees (
        ele_sername, ele_name, ele_patronymic, ele_photo,
        psn_id_FK, ele_snils, ele_birth, ele_tel, ele_email,
        ele_INN, ele_description, ess_id_FK
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.lastname,
        data.firstname,
        data.patronymic || null,
        data.photo || null, // Формата для фото Base64
        positionId,
        cleanSnils,
        formattedBirthdate,
        data.phone ? data.phone.replace(/\D/g, '') : null, // Очищаем телефон от форматирования
        data.email || null,
        data.inn || null,
        data.description || null,
        employeeStatus
      ]
    );

    const employeeId = employeeResult.insertId;

    // Если сотрудник должен отображаться в расписании, создаём для него рабочее расписание
    if (data.show_in_schedule && !data.dismissed) {
      // Создаём базовое рабочее расписание на ближайший месяц
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const workSchedules = [];
      const currentDate = new Date(startDate);
      
      // Создаём расписание на каждый рабочий день (пн-пт)
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        // Пн-Пт (1-5) - рабочие дни
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Создаём запись в Work_Schedules
          const [scheduleResult] = await conn.execute(
            `INSERT INTO Work_Schedules (wse_calend_numb, wse_workstart, wse_workend, swk_id_FK)
             VALUES (?, '09:00:00', '18:00:00', 2)`, // 2 - активный статус
            [dateStr]
          );
          
          // Связываем сотрудника с расписанием
          await conn.execute(
            `INSERT INTO Employee_Work_Schedules (wse_id_FK, ele_id_FK)
             VALUES (?, ?)`,
            [scheduleResult.insertId, employeeId]
          );
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    await conn.commit();
    
    res.status(200).json({ 
      status: "success", 
      message: "Сотрудник успешно добавлен",
      employeeId: employeeId
    });
    
  } catch (err) {
    await conn.rollback();
    console.error("Ошибка при добавлении сотрудника:", err);
    res.status(500).json({ 
      error: "Ошибка сервера при добавлении сотрудника", 
      detail: err.message 
    });
  } finally {
    await conn.end();
  }
};

// --------------------------------------------
// ЭНДПОИНТ 5: ПОЛУЧЕНИЕ СПИСКА СОТРУДНИКОВ
// --------------------------------------------
// GET /get-employees — выборка всех сотрудников
export const getEmployees = async (req, res) => {
  try {
    if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const conn = await mysql.createConnection(dbConfig);

    const [rows] = await conn.execute(`
      SELECT 
        e.ele_id AS №,
        CONCAT(e.ele_sername, ' ', e.ele_name, ' ', IFNULL(e.ele_patronymic, '')) AS ФИО,
        p.psn_name AS Должность,
        e.ele_tel AS Телефон,
        e.ele_birth AS Дата_рождения,
        CASE 
          WHEN e.ess_id_FK = 1 THEN 'Базовые права'
          WHEN e.ess_id_FK = 2 THEN 'Расширенные права'
          ELSE 'Права не назначены'
        END AS Набор_прав_доступа
      FROM Employees e
      JOIN Positions p ON e.psn_id_FK = p.psn_id
      ORDER BY e.ele_id
    `);

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error("Ошибка в /get-employees:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};

// --------------------------------------------
// ЭНДПОИНТ 9: ПОЛУЧЕНИЕ СПИСКА ВРАЧЕЙ
// --------------------------------------------
// GET /get-doctors — получение списка врачей для расписания
export const getDoctors = async (req, res) => {
  try {
    if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const conn = await mysql.createConnection(dbConfig);

    const [rows] = await conn.execute(`
      SELECT 
        ele_id,
        CONCAT(ele_sername, ' ', ele_name, ' ', IFNULL(ele_patronymic, '')) AS ФИО,
        p.psn_name AS Должность
      FROM Employees e
      JOIN Positions p ON e.psn_id_FK = p.psn_id
      WHERE p.psn_name IN ('Терапевт', 'Врач-ортодонт', 'Стоматолог-хирург', 'Стоматолог-ортопед')
      ORDER BY ele_sername, ele_name
    `);

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error("Ошибка в /get-doctors:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};
