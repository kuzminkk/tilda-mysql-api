// --------------------------------------------
// КОНФИГУРАЦИЯ ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ
// --------------------------------------------

import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.DB_HOST,      // Хост БД
  user: process.env.DB_USER,      // Имя пользователя БД
  password: process.env.DB_PASS,  // Пароль пользователя БД
  database: process.env.DB_NAME,  // Название базы данных
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306, // Порт (по умолчанию 3306)
};

// Экспортируем конфигурацию
export { dbConfig };

// Функция для создания подключения
export const createConnection = async () => {
  return await mysql.createConnection(dbConfig);
};
