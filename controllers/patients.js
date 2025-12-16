import mysql from "mysql2/promise";
import { dbConfig } from "../config/database.js";

// --------------------------------------------
// ЭНДПОИНТ 1: ПОЛУЧЕНИЕ СПИСКА ПАЦИЕНТОВ
// --------------------------------------------
// GET /get-patients — выборка всех пациентов с агрегированной информацией
export const getPatients = async (req, res) => {
  try {
    // Проверка API ключа (если он задан в .env)
    if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Создаем подключение к БД
    const conn = await mysql.createConnection(dbConfig);

    // Выполняем SQL запрос для получения списка пациентов
    const [rows] = await conn.execute(`
      SELECT 
        CONCAT(p.ptt_sername, ' ', p.ptt_name, ' ', IFNULL(p.ptt_patronymic, '')) AS ФИО,
        p.ptt_tel AS Телефон,
        COUNT(v.vst_id) AS Количество_визитов,
        p.ptt_birth AS Дата_рождения,
        MAX(v.vst_date) AS Дата_последнего_визита,
        p.ptt_date_creation AS Дата_добавления_в_систему
      FROM Patients p
      LEFT JOIN Visits v ON p.ptt_id = v.ptt_id_FK
      GROUP BY p.ptt_id, p.ptt_sername, p.ptt_name, p.ptt_patronymic, p.ptt_tel, p.ptt_birth, p.ptt_date_creation
      ORDER BY p.ptt_id
    `);

    // Закрываем соединение с БД
    await conn.end();
    
    // Отправляем результат в формате JSON
    res.json(rows);
  } catch (err) {
    // Обработка ошибок
    console.error("Ошибка в /get-patients:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};

// --------------------------------------------
// ЭНДПОИНТ 3: ДОБАВЛЕНИЕ НОВОГО ПАЦИЕНТА
// --------------------------------------------
// POST / — добавление пациента из формы Тильды
export const addPatient = async (req, res) => {
  const data = req.body;
  const conn = await mysql.createConnection(dbConfig);

  try {
    // Начинаем транзакцию для обеспечения целостности данных
    await conn.beginTransaction();

    //1 Создаём запись в Contract_Documents (договор пациента)
    const [docResult] = await conn.execute(`
      INSERT INTO Contract_Documents (cdt_date_creation)
      VALUES (CURDATE())
    `);
    const contractId = docResult.insertId;

    //2 Добавляем пациента в основную таблицу
    const [patientResult] = await conn.execute(
      `
      INSERT INTO Patients (
        ptt_sername, ptt_name, ptt_patronymic, ptt_photo,
        ptt_birth, ptt_gender, ptt_tel, ptt_address, ptt_email,
        ptt_policyOMS, ptt_snils, ptt_passport_number, ptt_passport_series, ptt_date_of_issue,
        ptt_disability, ptt_allergy, ptt_diseases, ptt_complaints,
        ptt_date_creation, cdt_id_FK
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)
    `,
      [
        data.lastname,
        data.firstname,
        data.patronymic || null,
        data.file || null,
        data.birthdate || null,
        data.gender || "Не указано",
        data.phone || null,
        data.address || null,
        data.email || null,
        data.oms || null,
        data.snils || null,
        data.pass_number || null,
        data.pass_series || null,
        data.pass_issued || null,
        data.disability || null,
        data.allergies || null,
        data.comorbid || null,
        data.complaints || null,
        contractId,
      ]
    );

    const patientId = patientResult.insertId;

    //3 Привязка категории пациента (например, "Взрослый" = id 5)
    await conn.execute(
      `
      INSERT INTO Patient_Categories (ptt_id_FK, cty_id_FK)
      VALUES (?, ?)
    `,
      [patientId, 5]
    );

    //4 Если прикреплён файл (PDF или фото документа) - сохраняем его
    if (data.file && data.fileName) {
      await conn.execute(
        `
        INSERT INTO Documents (dct_name, dct_dateupload, dct_document, ptt_id_FK)
        VALUES (?, CURDATE(), ?, ?)
      `,
        [data.fileName, data.file, patientId]
      );
    }

    // Фиксируем транзакцию
    await conn.commit();
    res.status(200).json({ status: "ok", message: "Пациент успешно добавлен" });
  } catch (err) {
    // Откатываем транзакцию при ошибке
    await conn.rollback();
    console.error("Ошибка при вставке пациента:", err);
    res.status(500).json({ error: "Ошибка сервера", detail: err.message });
  } finally {
    // Закрываем соединение
    await conn.end();
  }
};

// --------------------------------------------
// ЭНДПОИНТ 6: ОБНОВЛЕНИЕ ДАННЫХ ПАЦИЕНТА
// --------------------------------------------
// PUT /update-patient — обновление информации о пациенте
export const updatePatient = async (req, res) => {
  const data = req.body;
  const conn = await mysql.createConnection(dbConfig);

  try {
    await conn.beginTransaction();

    // Преобразуем пол для БД (из формата фронтенда в формат БД)
    let genderDB = "Не указано";
    if (data.gender === "male") genderDB = "Мужской";
    if (data.gender === "female") genderDB = "Женский";

    // Обновляем данные пациента
    await conn.execute(
      `
      UPDATE Patients SET
        ptt_sername = ?,
        ptt_name = ?,
        ptt_patronymic = ?,
        ptt_birth = ?,
        ptt_gender = ?,
        ptt_tel = ?,
        ptt_address = ?,
        ptt_email = ?,
        ptt_policyOMS = ?,
        ptt_snils = ?,
        ptt_passport_series = ?,
        ptt_passport_number = ?,
        ptt_date_of_issue = ?,
        ptt_disability = ?,
        ptt_allergy = ?,
        ptt_diseases = ?,
        ptt_complaints = ?
      WHERE ptt_id = ?
      `,
      [
        data.lastname,
        data.firstname,
        data.patronymic || null,
        data.birthdate || null,
        genderDB,
        data.phone || null,
        data.address || null,
        data.email || null,
        data.oms || null,
        data.snils || null,
        data.pass_series || null,
        data.pass_number || null,
        data.pass_issued || null,
        data.disability || null,
        data.allergies || null,
        data.comorbid || null,
        data.complaints || null,
        data.patient_id
      ]
    );

    await conn.commit();
    res.status(200).json({ status: "success", message: "Данные пациента обновлены" });
  } catch (err) {
    await conn.rollback();
    console.error("Ошибка при обновлении пациента:", err);
    res.status(500).json({ error: "Ошибка сервера", detail: err.message });
  } finally {
    await conn.end();
  }
};

// --------------------------------------------
// ЭНДПОИНТ 7: ПОЛУЧЕНИЕ ПОЛНЫХ ДАННЫХ ПАЦИЕНТА
// --------------------------------------------
// GET /get-patient-full — получение всей информации о пациенте по ФИО
export const getPatientFull = async (req, res) => {
  const { lastname, firstname, patronymic, api_key } = req.query;

  if (process.env.API_KEY && api_key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Валидация входных данных
  if (!lastname || !firstname) {
    return res.status(400).json({ error: "Не указаны фамилия и имя" });
  }

  const conn = await mysql.createConnection(dbConfig);

  try {
    let query = `
      SELECT * FROM Patients 
      WHERE ptt_sername = ? 
        AND ptt_name = ?
    `;
    let params = [lastname, firstname];

    // Добавляем условие по отчеству, если оно указано
    if (patronymic) {
      query += ` AND ptt_patronymic = ?`;
      params.push(patronymic);
    } else {
      query += ` AND (ptt_patronymic IS NULL OR ptt_patronymic = '')`;
    }

    // Ограничиваем количество выводимых строк
    query += ` LIMIT 1`;

    const [rows] = await conn.execute(query, params);

    await conn.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Пациент не найден" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Ошибка в /get-patient-full:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};

// --------------------------------------------
// ЭНДПОИНТ 12: ПОЛУЧЕНИЕ ID ПАЦИЕНТА ПО ФИО
// --------------------------------------------
// GET /get-patient-id — получение идентификатора пациента по ФИО
export const getPatientId = async (req, res) => {
  const { lastname, firstname, patronymic, api_key } = req.query;

  if (process.env.API_KEY && api_key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!lastname || !firstname) {
    return res.status(400).json({ error: "Не указаны фамилия и имя" });
  }

  const conn = await mysql.createConnection(dbConfig);

  try {
    const [rows] = await conn.execute(
      `
      SELECT ptt_id as patient_id FROM Patients 
      WHERE ptt_sername = ? 
        AND ptt_name = ?
        AND (ptt_patronymic = ? OR ? IS NULL OR ptt_patronymic IS NULL)
      LIMIT 1
      `,
      [lastname, firstname, patronymic || null, patronymic || null]
    );

    await conn.end();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Пациент не найден" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Ошибка в /get-patient-id:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};
