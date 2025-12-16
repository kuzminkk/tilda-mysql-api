// --------------------------------------------
// ИМПОРТ БИБЛИОТЕК И НАСТРОЙКА ОКРУЖЕНИЯ
// --------------------------------------------

// Express - фреймворк для создания веб-сервера
import express from "express";

// dotenv - загрузка переменных окружения из .env файла
import dotenv from "dotenv";

// cors - для обработки Cross-Origin Resource Sharing
import cors from "cors";

// Загружаем переменные окружения
dotenv.config();

// Импортируем настройки CORS
import { corsOptions } from "./config/cors.js";

// Импортируем маршруты API
import apiRoutes from "./routes/api.js";

// Создаем экземпляр приложения Express
const app = express();

// Для обработки JSON в телах запросов
app.use(express.json());

// --------------------------------------------
// НАСТРОЙКА CORS (БЕЗОПАСНОСТЬ)
// --------------------------------------------

app.use(cors(corsOptions));

// --------------------------------------------
// ПОДКЛЮЧЕНИЕ МАРШРУТОВ
// --------------------------------------------

app.use("/", apiRoutes);

// --------------------------------------------
// ЗАПУСК СЕРВЕРА
// --------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
