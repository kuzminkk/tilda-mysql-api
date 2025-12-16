import mysql from "mysql2/promise";
import { dbConfig } from "../config/database.js";

// --------------------------------------------
// ЭНДПОИНТ 8: ПОЛУЧЕНИЕ СПИСКА СТОМАТОЛОГИЧЕСКИХ УСЛУГ
// --------------------------------------------
// GET /get-dental-services — получение каталога услуг
export const getDentalServices = async (req, res) => {
  try {
    if (process.env.API_KEY && req.query.api_key !== process.env.API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const conn = await mysql.createConnection(dbConfig);

    const [rows] = await conn.execute(`
      SELECT 
        dse_id,
        dse_name,
        dse_price,
        dse_warranty,
        dse_description,
        scy_id_FK
      FROM Dental_Services
      ORDER BY dse_name
    `);

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error("Ошибка в /get-dental-services:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
};
