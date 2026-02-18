const express = require('express');
const router = express.Router();
// Kod doğrulama endpointi
router.post('/verify-reset-code', require('../controllers/auth.controller').verifyResetCode);
// Reset code status kontrolü
router.post('/check-reset-code-status', require('../controllers/auth.controller').checkResetCodeStatus);
const {
  register,
  login,
  resetPassword,
  confirmResetPassword,
  getUserByEmail,
  createGroup,
  getUserGroups,
  addPersonToGroup,
  getGroupDetails,
  deletePersonFromGroup,
  updatePersonInGroup,
  deleteGroup,
  getPersonFromGroup,
  getMessageRateLimit,
  updateMessageRateLimit
} = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Register
router.post('/register', register);

// Login
router.post('/login', login);

// Reset Password
router.post('/reset-password', resetPassword);

// Confirm Reset Password
router.post('/reset-password/confirm', confirmResetPassword);

// Get user details
router.post('/user', getUserByEmail);

// Settings page placeholder route
router.get('/settings', verifyToken, (req, res) => {
  res.json({ message: 'Settings page data endpoint' });
});

// Message Rate Limit Routes
router.get('/message-rate-limit', verifyToken, getMessageRateLimit);
router.put('/message-rate-limit', verifyToken, updateMessageRateLimit);

// User Message Limit Routes
// GET /user/message-limit: fetch current user's message limit
router.get('/user/message-limit', verifyToken, getMessageRateLimit);
router.post('/user/message-limit', verifyToken, updateMessageRateLimit);

// Group Routes
router.post('/groups', verifyToken, createGroup);

router.get('/groups', verifyToken, getUserGroups);

router.post('/groups/:groupId/person', verifyToken, addPersonToGroup);

router.get('/groups/:groupId/person/:personId', verifyToken, getPersonFromGroup);

router.get('/groups/:groupId/details', verifyToken, getGroupDetails);

router.delete('/groups/:groupId/person/:personId', verifyToken, deletePersonFromGroup);

router.put('/groups/:groupId/person/:personId', verifyToken, updatePersonInGroup);

router.delete('/groups/:groupId', verifyToken, deleteGroup);

module.exports = router;