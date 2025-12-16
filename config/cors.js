// --------------------------------------------
// НАСТРОЙКА CORS (БЕЗОПАСНОСТЬ)
// --------------------------------------------

// Список разрешенных доменов для CORS (доступ к API)
const allowedOrigins = [
  "https://project16054216.tilda.ws",
  "http://project16054216.tilda.ws",
  "http://systemdental.tilda.ws",
  "https://project17567096.tilda.ws",
  "http://project17567096.tilda.ws", 
  "http://systemdental.tilda.ws",
  "https://systemdental.tilda.ws",
  "https://tilda.ws"
];

// Настройка CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы из разрешенных источников
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

export { allowedOrigins, corsOptions };
