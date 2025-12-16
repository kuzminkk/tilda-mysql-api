import mysql from "mysql2/promise";
import { dbConfig } from "../config/database.js";

// --------------------------------------------
// ЭНДПОИНТ 14: ПОЛУЧЕНИЕ ВЫРУЧКИ ЗА ПОСЛЕДНИЕ 3 МЕСЯЦА
// --------------------------------------------
// GET /get-revenue-last-3-months — аналитика выручки
export const getRevenueLast3Months = async (req, res) => {
  try {
    if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const conn = await mysql.createConnection(dbConfig);

    // SQL запрос для агрегации выручки по месяцам
    const [rows] = await conn.execute(`
      SELECT 
        YEAR(v.vst_date) as year,
        MONTH(v.vst_date) as month,
        SUM(COALESCE(v.vst_final_sumservice, 0)) AS revenue
      FROM Visits v
      WHERE v.vst_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
        AND v.vst_final_sumservice IS NOT NULL
        AND v.vst_final_sumservice > 0
      GROUP BY YEAR(v.vst_date), MONTH(v.vst_date)
      ORDER BY YEAR(v.vst_date) DESC, MONTH(v.vst_date) DESC
      LIMIT 3
    `);

    await conn.end();

    // Функция для получения русского названия месяца
    const getRussianMonthName = (month) => {
      const months = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
      ];
      return months[month - 1];
    };

    // Если данных нет, возвращаем демо-данные с русскими названиями
    if (rows.length === 0) {
      const currentDate = new Date();
      const months = [];
      
      for (let i = 0; i < 3; i++) {
        const date = new Date(currentDate);
        date.setMonth(currentDate.getMonth() - i);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const monthName = getRussianMonthName(month);
        
        months.push({
          name: `${monthName} ${year}`,
          revenue: 0
        });
      }
      
      return res.json({ months });
    }

    // Форматируем данные для фронтенда с русскими названиями месяцев
    const formattedData = {
      months: rows.map(row => ({
        name: `${getRussianMonthName(row.month)} ${row.year}`,
        revenue: parseFloat(row.revenue) || 0
      }))
    };

    res.json(formattedData);
  } catch (err) {
    console.error("Ошибка в /get-revenue-last-3-months:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};

// --------------------------------------------
// ЭНДПОИНТ 15: СТАТИСТИКА ПОСЕЩЕНИЙ ПО СОТРУДНИКАМ
// --------------------------------------------
// GET /get-visits-by-employees — аналитика количества приемов по врачам
export const getVisitsByEmployees = async (req, res) => {
  try {
    if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const conn = await mysql.createConnection(dbConfig);

    const [rows] = await conn.execute(`
      SELECT 
        CONCAT(e.ele_sername, ' ', e.ele_name, ' ', IFNULL(e.ele_patronymic, '')) AS employee_name,
        p.psn_name AS position,
        COUNT(v.vst_id) AS visits_count
      FROM Employees e
      JOIN Positions p ON e.psn_id_FK = p.psn_id
      LEFT JOIN Visits v ON e.ele_id = v.ele_id_FK
      WHERE p.psn_name IN ('Терапевт', 'Врач-ортодонт', 'Стоматолог-хирург', 'Стоматолог-ортопед')
        AND v.vst_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
      GROUP BY e.ele_id, e.ele_sername, e.ele_name, e.ele_patronymic, p.psn_name
      ORDER BY visits_count DESC
    `);

    await conn.end();

    // Форматируем данные для фронтенда
    const formattedData = {
      employees: rows.map(row => ({
        name: row.employee_name,
        position: row.position,
        visits: parseInt(row.visits_count) || 0
      }))
    };

    res.json(formattedData);
  } catch (err) {
    console.error("Ошибка в /get-visits-by-employees:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};
