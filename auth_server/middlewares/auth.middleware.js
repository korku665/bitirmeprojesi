const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.verifyToken = async (req, res, next) => {
  console.log('Request headers:', req.headers);
  const authHeader = req.headers['authorization'];
  console.log('Authorization header:', authHeader);
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Extracted token:', token);

  if (!token) {
    return res.status(401).json({ message: 'Token eksik.' });
  }

  try {
    // Önce JWT olarak dene
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT:', decoded);
    
    // Kullanıcı bilgilerini DB’den çekelim ki limit bilgisini de alabilelim
    const rows = await db.query('SELECT id, message_rate_limit FROM users WHERE id = ?', [decoded.id]);
    if (!rows || rows.length === 0) {
      return res.status(403).json({ message: 'Geçersiz token.' });
    }
    const user = rows[0];
    req.user = { id: user.id, message_rate_limit: user.message_rate_limit };
    req.userId = user.id;
    return next();

  } catch (err) {
    console.log('JWT verification failed, trying user_token fallback.');
    // Eğer JWT değilse user_token olarak kontrol et
    try {
      const rows = await db.query('SELECT id, message_rate_limit FROM users WHERE user_token = ?', [token]);
      if (!rows || rows.length === 0) {
        return res.status(403).json({ message: 'Geçersiz token.' });
      }
      const user = rows[0];
      req.user = { id: user.id, message_rate_limit: user.message_rate_limit };
      req.userId = user.id;
      return next();
    } catch (dbErr) {
      console.error('Token doğrulama hatası:', dbErr.message);
      return res.status(500).json({ message: 'Sunucu hatası.' });
    }
  }
};