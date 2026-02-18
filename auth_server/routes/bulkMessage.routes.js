const express = require('express');
const router = express.Router();

const { sendBulkMessages, sendMultiMessages, sendSingleMessage } = require('../controllers/bulkMessage.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/messages/single', verifyToken, sendSingleMessage);


router.post('/messages/bulk', verifyToken, sendBulkMessages);
router.post('/messages/multi', verifyToken, sendMultiMessages);

module.exports = router;
