const express = require('express');
const router = express.Router();

const { sendBulkMessages, sendMultiMessages, sendSingleMessage, sendSingleImage, sendMultiImages, sendBulkImages } = require('../controllers/bulkMessage.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Metin mesajları
router.post('/messages/single', verifyToken, sendSingleMessage);
router.post('/messages/bulk', verifyToken, sendBulkMessages);
router.post('/messages/multi', verifyToken, sendMultiMessages);

// Resimli mesajlar
router.post('/messages/single-image', verifyToken, sendSingleImage);
router.post('/messages/bulk-image', verifyToken, sendBulkImages);
router.post('/messages/multi-image', verifyToken, sendMultiImages);

module.exports = router;
