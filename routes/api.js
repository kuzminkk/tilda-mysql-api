import express from "express";

// Импортируем контроллеры
import { 
  getPatients, 
  addPatient, 
  updatePatient, 
  getPatientFull, 
  getPatientId 
} from "../controllers/patients.js";

import { 
  getEmployees, 
  addEmployee, 
  getDoctors 
} from "../controllers/employees.js";

import { 
  getVisitInfo, 
  saveVisit, 
  cleanupDuplicates 
} from "../controllers/visits.js";

import { 
  getDentalServices 
} from "../controllers/services.js";

import { 
  processPayment 
} from "../controllers/payments.js";

import { 
  getRevenueLast3Months, 
  getVisitsByEmployees 
} from "../controllers/analytics.js";

const router = express.Router();

// --------------------------------------------
// ЭНДПОИНТ 1: ПОЛУЧЕНИЕ СПИСКА ПАЦИЕНТОВ
// --------------------------------------------
// GET /get-patients — выборка всех пациентов с агрегированной информацией
router.get("/get-patients", getPatients);

// --------------------------------------------
// ЭНДПОИНТ 2: ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ВИЗИТАХ ПАЦИЕНТА
// --------------------------------------------
// GET /get-visit-info — получение детальной информации по визитам конкретного пациента
router.get("/get-visit-info", getVisitInfo);

// --------------------------------------------
// ЭНДПОИНТ 3: ДОБАВЛЕНИЕ НОВОГО ПАЦИЕНТА
// --------------------------------------------
// POST / — добавление пациента из формы Тильды
router.post("/", addPatient);

// --------------------------------------------
// ЭНДПОИНТ 4: ДОБАВЛЕНИЕ СОТРУДНИКА
// --------------------------------------------
// POST /add-employee — добавление нового сотрудника
router.post("/add-employee", addEmployee);

// --------------------------------------------
// ЭНДПОИНТ 5: ПОЛУЧЕНИЕ СПИСКА СОТРУДНИКОВ
// --------------------------------------------
// GET /get-employees — выборка всех сотрудников
router.get("/get-employees", getEmployees);

// --------------------------------------------
// ЭНДПОИНТ 6: ОБНОВЛЕНИЕ ДАННЫХ ПАЦИЕНТА
// --------------------------------------------
// PUT /update-patient — обновление информации о пациенте
router.put("/update-patient", updatePatient);

// --------------------------------------------
// ЭНДПОИНТ 7: ПОЛУЧЕНИЕ ПОЛНЫХ ДАННЫХ ПАЦИЕНТА
// --------------------------------------------
// GET /get-patient-full — получение всей информации о пациенте по ФИО
router.get("/get-patient-full", getPatientFull);

// --------------------------------------------
// ЭНДПОИНТ 8: ПОЛУЧЕНИЕ СПИСКА СТОМАТОЛОГИЧЕСКИХ УСЛУГ
// --------------------------------------------
// GET /get-dental-services — получение каталога услуг
router.get("/get-dental-services", getDentalServices);

// --------------------------------------------
// ЭНДПОИНТ 9: ПОЛУЧЕНИЕ СПИСКА ВРАЧЕЙ
// --------------------------------------------
// GET /get-doctors — получение списка врачей для расписания
router.get("/get-doctors", getDoctors);

// --------------------------------------------
// ЭНДПОИНТ 10: СОХРАНЕНИЕ ВИЗИТА
// --------------------------------------------
// POST /save-visit — создание или редактирование визита пациента
router.post("/save-visit", saveVisit);

// --------------------------------------------
// ЭНДПОИНТ 11: ОБРАБОТКА ОПЛАТЫ
// --------------------------------------------
// POST /process-payment — обработка оплаты визита
router.post("/process-payment", processPayment);

// --------------------------------------------
// ЭНДПОИНТ 12: ПОЛУЧЕНИЕ ID ПАЦИЕНТА ПО ФИО
// --------------------------------------------
// GET /get-patient-id — получение идентификатора пациента по ФИО
router.get("/get-patient-id", getPatientId);

// --------------------------------------------
// ЭНДПОИНТ 13: ОЧИСТКА ДУБЛИКАТОВ УСЛУГ
// --------------------------------------------
// POST /cleanup-duplicates — удаление дублирующихся услуг в визите
router.post("/cleanup-duplicates", cleanupDuplicates);

// --------------------------------------------
// ЭНДПОИНТ 14: ПОЛУЧЕНИЕ ВЫРУЧКИ ЗА ПОСЛЕДНИЕ 3 МЕСЯЦА
// --------------------------------------------
// GET /get-revenue-last-3-months — аналитика выручки
router.get("/get-revenue-last-3-months", getRevenueLast3Months);

// --------------------------------------------
// ЭНДПОИНТ 15: СТАТИСТИКА ПОСЕЩЕНИЙ ПО СОТРУДНИКАМ
// --------------------------------------------
// GET /get-visits-by-employees — аналитика количества приемов по врачам
router.get("/get-visits-by-employees", getVisitsByEmployees);

export default router;
