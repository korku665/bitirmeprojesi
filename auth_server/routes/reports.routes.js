
const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Bugün gönderilen başarılı mesaj sayısı
router.get('/reports/today-sent-count', verifyToken, reportsController.getTodaySentCount);

// Gönderim raporları (sayfalı liste)
router.get('/reports/sent', verifyToken, reportsController.getSentReports);

// Dashboard özet verileri (kullanıcıya özel)
router.get('/reports/dashboard', verifyToken, reportsController.getUserDashboardStats);

// Belirli bir rapordaki mesaj detayları
router.get('/reports/messages/:id', verifyToken, reportsController.getReportDetails);

module.exports = router;