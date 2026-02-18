// --- YENİ: Kod Doğrulama ---
exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ valid: false, message: 'Email ve kod gerekli' });
  try {
    const result = await db.query('SELECT reset_password_token, reset_password_expires FROM users WHERE email = ?', [email]);
    const user = result[0];
    if (!user) return res.status(404).json({ valid: false, message: 'Kullanıcı bulunamadı' });
    const now = new Date();
    if (
      user.reset_password_token &&
      user.reset_password_expires &&
      new Date(user.reset_password_expires) > now &&
      user.reset_password_token === code
    ) {
      return res.json({ valid: true });
    } else {
      return res.json({ valid: false, message: 'Kod yanlış veya süresi dolmuş.' });
    }
  } catch (err) {
    console.error('verifyResetCode error:', err.message);
    return res.status(500).json({ valid: false, message: 'Sunucu hatası' });
  }
};
// --- YENİ: Kod Gönderildi mi Kontrolü ---
exports.checkResetCodeStatus = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email gerekli' });
  try {
    const result = await db.query('SELECT reset_password_token, reset_password_expires FROM users WHERE email = ?', [email]);
    const user = result[0];
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    const now = new Date();
    if (
      user.reset_password_token &&
      user.reset_password_expires &&
      new Date(user.reset_password_expires) > now
    ) {
      return res.json({ codeSent: true });
    } else {
      return res.json({ codeSent: false });
    }
  } catch (err) {
    console.error('checkResetCodeStatus error:', err.message);
    return res.status(500).json({ message: 'Sunucu hatası' });
  }
};
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendMail = require('../utils/sendMail');

// REGISTER
exports.register = async (req, res) => {
  const { email, phone, password, firstName, lastName } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const userToken = crypto.randomBytes(16).toString('hex');
    await db.query(
      `INSERT INTO users (email, phone, password_hash, firstName, lastName, user_token, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [email, phone, hashed, firstName, lastName, userToken]
    );
    const [user] = await db.query(
      `SELECT id, email, phone, firstName, lastName, user_token, created_at FROM users WHERE email = ?`,
      [email]
    );
    res.status(201).json({ message: 'Kayıt başarılı', user, token: user.user_token });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Kayıt başarısız', details: err.message });
  }
};

// LOGIN
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = result[0];

    if (!user) return res.status(400).json({ error: 'Kullanıcı bulunamadı' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Şifre hatalı' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });
    // For simplicity, groupToken is the same as token. You can use a different payload if needed.
    const groupToken = token;

    res.json({
      token,
      groupToken,
      userToken: user.user_token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        user_token: user.user_token
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Giriş başarısız', details: err.message });
  }
};


// RESET PASSWORD (PostgreSQL)
exports.resetPassword = async (req, res) => {
  console.log('✅ /auth/reset-password endpointine istek geldi:', req.body.email);
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'E-posta gerekli' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = result[0];

    if (!user) {
      return res.status(404).json({ message: 'Bu e-posta kayıtlı değil' });
    }

    // 6 haneli doğrulama kodu üret
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Veritabanında kaydet: token + expires (2 dakika süreli)
    await db.query(
      `UPDATE users SET reset_password_token = ?, reset_password_expires = NOW() + INTERVAL 2 MINUTE WHERE email = ?`,
      [code, email]
    );

    // Kod içeren mail gönder
    await sendMail(
      email,
      'Şifre Sıfırlama Kodu',
      `Şifre sıfırlama kodunuz: ${code}\nBu kod 2 dakika içinde geçerliliğini yitirecektir.`
    );

    return res.json({ message: 'Doğrulama kodu e-posta adresinize gönderildi.' });

  } catch (err) {
    console.error('Şifre sıfırlama hatası:', err.message);
    return res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// Kod Doğrulama ve Şifre Sıfırlama
exports.confirmResetPassword = async (req, res) => {

  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Tüm alanlar zorunlu.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = result[0];

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    // Yeni şifreyi hashle ve kaydet
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE email = ?`,
      [hashedPassword, email]
    );

    return res.json({ message: 'Şifre başarıyla sıfırlandı.' });

  } catch (err) {
    console.error('Şifre sıfırlama doğrulama hatası:', err.message);
    return res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// ✅ KULLANICI BİLGİLERİNİ ÇEK
exports.getUserByEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email gerekli' });

  try {
    const result = await db.query(
      `SELECT id, email, phone, firstName, lastName, created_at FROM users WHERE email = ?`,
      [email]
    );

    if (result.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    return res.json({ user: result[0] });

  } catch (err) {
    console.error('getUserByEmail error:', err.message);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
};

// ✅ GRUP OLUŞTUR
exports.createGroup = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  if (!name) return res.status(400).json({ error: 'Grup adı gerekli' });

  try {
    const groupResult = await db.query(
      `INSERT INTO user_groups (user_id, name, created_at)
       VALUES (?, ?, NOW())`,
      [userId, name]
    );

    // MySQL için yeni eklenen grup id'si
    const newGroupId = groupResult.insertId;

    return res.status(201).json({
      message: 'Grup başarıyla oluşturuldu',
      group: { id: newGroupId, name, user_id: userId }
    });
  } catch (err) {
    console.error('createGroup error:', err.message);
    return res.status(500).json({ error: 'Grup oluşturulamadı' });
  }
};

// ✅ GRUP SİL
exports.deleteGroup = async (req, res) => {
  const userId = req.user.id;
  const groupId = req.params.groupId;
  try {
    const [check] = await db.query(
      `SELECT * FROM user_groups WHERE id = ? AND user_id = ?`,
      [groupId, userId]
    );
    if (!check) {
      return res.status(403).json({ error: 'Bu gruba erişiminiz yok' });
    }
    await db.query(`DELETE FROM user_group_members WHERE group_id = ?`, [groupId]);
    const delRes = await db.query(`DELETE FROM user_groups WHERE id = ?`, [groupId]);
    return res.json({ message: 'Grup başarıyla silindi' });
  } catch (err) {
    console.error('deleteGroup error:', err.message);
    return res.status(500).json({ error: 'Grup silinemedi' });
  }
};

// ✅ KULLANICININ TÜM GRUPLARINI GETİR
exports.getUserGroups = async (req, res) => {
  const userId = req.user.id;
  try {
    const groups = await db.query(
      `SELECT g.id, g.name, g.created_at, COUNT(p.id) as person_count
       FROM user_groups g
       LEFT JOIN user_group_members p ON g.id = p.group_id
       WHERE g.user_id = ?
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [userId]
    );
    return res.json({ groups });
  } catch (err) {
    console.error('getGroups error:', err.message);
    return res.status(500).json({ error: 'Gruplar alınamadı' });
  }
};

// ✅ GRUBA KİŞİ EKLE
exports.addPersonToGroup = async (req, res) => {
  const userId = req.user.id;
  const groupId = req.params.groupId;
  let {
    phone, name, surname, birthDate, membershipDate,
    city, gender, lastOrderDate,
    custom1, custom2, custom3, custom4, custom5,
    custom6, custom7, custom8, custom9, custom10,
    custom11, custom12, custom13
  } = req.body;

  // Ad ve soyad zorunlu kontrolü
  if (!name || !surname) {
    return res.status(400).json({ error: 'Ad ve soyad zorunludur' });
  }

  // Normalize values: undefined -> null
  phone = phone === undefined ? null : phone;
  name = name === undefined ? null : name;
  surname = surname === undefined ? null : surname;
  birthDate = birthDate === undefined ? null : birthDate;
  membershipDate = membershipDate === undefined ? null : membershipDate;
  city = city === undefined ? null : city;
  gender = gender === undefined ? null : gender;
  lastOrderDate = lastOrderDate === undefined ? null : lastOrderDate;
  custom1 = custom1 === undefined ? null : custom1;
  custom2 = custom2 === undefined ? null : custom2;
  custom3 = custom3 === undefined ? null : custom3;
  custom4 = custom4 === undefined ? null : custom4;
  custom5 = custom5 === undefined ? null : custom5;
  custom6 = custom6 === undefined ? null : custom6;
  custom7 = custom7 === undefined ? null : custom7;
  custom8 = custom8 === undefined ? null : custom8;
  custom9 = custom9 === undefined ? null : custom9;
  custom10 = custom10 === undefined ? null : custom10;
  custom11 = custom11 === undefined ? null : custom11;
  custom12 = custom12 === undefined ? null : custom12;
  custom13 = custom13 === undefined ? null : custom13;

  try {
    console.log('addPersonToGroup userId:', userId, 'groupId:', groupId);
    const [check] = await db.query(
      `SELECT * FROM user_groups WHERE id = ? AND user_id = ?`,
      [groupId, userId]
    );
    if (!check) {
      // Kullanıcının sahip olduğu grupları da döndür
      const groups = await db.query(`SELECT id, name FROM user_groups WHERE user_id = ?`, [userId]);
      return res.status(403).json({ error: 'Bu gruba erişiminiz yok', userGroups: groups });
    }
    await db.query(
      `INSERT INTO user_group_members
       (group_id, phone, name, surname, birth_date, membership_date,
        city, gender, last_order_date, custom1, custom2, custom3, custom4,
        custom5, custom6, custom7, custom8, custom9, custom10, custom11, custom12, custom13)
       VALUES
       (?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        groupId, phone, name, surname, birthDate, membershipDate,
        city, gender, lastOrderDate, custom1, custom2, custom3, custom4,
        custom5, custom6, custom7, custom8, custom9, custom10,
        custom11, custom12, custom13
      ]
    );
    return res.json({ message: 'Kişi başarıyla eklendi' });
  } catch (err) {
    console.error('addPersonToGroup error:', err); // tüm hatayı logla
    return res.status(500).json({ error: 'Kişi eklenemedi', details: err.message });
  }
};

// ✅ GRUP DETAYLARI + KİŞİLER
exports.getGroupDetails = async (req, res) => {
  const userId = req.user.id;
  const groupId = req.params.groupId;

  try {
    const [group] = await db.query(
      `SELECT id, name FROM user_groups WHERE id = ? AND user_id = ?`,
      [groupId, userId]
    );
    if (!group) {
      return res.status(404).json({ error: 'Grup bulunamadı veya erişiminiz yok' });
    }
    const persons = await db.query(
      `SELECT id, name, surname, phone, city,
              DATE_FORMAT(membership_date, '%Y-%m-%d') AS membership_date,
              DATE_FORMAT(birth_date, '%Y-%m-%d') AS birth_date,
              DATE_FORMAT(last_order_date, '%Y-%m-%d') AS last_order_date,
              gender,
              custom1, custom2, custom3, custom4, custom5,
              custom6, custom7, custom8, custom9, custom10,
              custom11, custom12, custom13
       FROM user_group_members
       WHERE group_id = ?`,
      [groupId]
    );
    return res.json({ group, persons });
  } catch (err) {
    console.error('getGroupDetails error:', err.message);
    return res.status(500).json({ error: 'Grup detayları alınamadı' });
  }
};

// ✅ GRUPTAN KİŞİ GETİR
exports.getPersonFromGroup = async (req, res) => {
  const userId = req.user.id;
  const { groupId, personId } = req.params;
  try {
    const [check] = await db.query(
      `SELECT * FROM user_groups WHERE id = ? AND user_id = ?`,
      [groupId, userId]
    );
    if (!check) {
      return res.status(403).json({ error: 'Bu gruba erişiminiz yok' });
    }
    const [person] = await db.query(
      `SELECT id, name, surname, phone, city,
              DATE_FORMAT(membership_date, '%Y-%m-%d') AS membership_date,
              DATE_FORMAT(birth_date, '%Y-%m-%d') AS birth_date,
              DATE_FORMAT(last_order_date, '%Y-%m-%d') AS last_order_date,
              gender,
              custom1, custom2, custom3, custom4, custom5,
              custom6, custom7, custom8, custom9, custom10,
              custom11, custom12, custom13
       FROM user_group_members
       WHERE id = ? AND group_id = ?`,
      [personId, groupId]
    );
    if (!person) {
      return res.status(404).json({ error: 'Kişi bulunamadı' });
    }
    return res.json({ person });
  } catch (err) {
    console.error('getPersonFromGroup error:', err.message);
    return res.status(500).json({ error: 'Kişi bilgileri alınamadı' });
  }
};

// ✅ GRUPTAN KİŞİ SİL
exports.deletePersonFromGroup = async (req, res) => {
  const userId = req.user.id;
  const { groupId, personId } = req.params;
  try {
    const [check] = await db.query(
      `SELECT * FROM user_groups WHERE id = ? AND user_id = ?`,
      [groupId, userId]
    );
    if (!check) {
      return res.status(403).json({ error: 'Bu gruba erişiminiz yok' });
    }
    await db.query(
      `DELETE FROM user_group_members WHERE id = ? AND group_id = ?`,
      [personId, groupId]
    );
    return res.json({ message: 'Kişi başarıyla silindi' });
  } catch (err) {
    console.error('deletePersonFromGroup error:', err.message);
    return res.status(500).json({ error: 'Kişi silinemedi' });
  }
};

// ✅ KİŞİYİ GÜNCELLE
exports.updatePersonInGroup = async (req, res) => {
  const userId = req.user.id;
  const { groupId, personId } = req.params;
  const {
    name, surname, phone, city, gender, membershipDate, birthDate, lastOrderDate,
    custom1, custom2, custom3, custom4, custom5,
    custom6, custom7, custom8, custom9, custom10,
    custom11, custom12, custom13
  } = req.body;
  try {
    const [check] = await db.query(
      `SELECT * FROM user_groups WHERE id = ? AND user_id = ?`,
      [groupId, userId]
    );
    if (!check) {
      return res.status(403).json({ error: 'Bu gruba erişiminiz yok' });
    }
    await db.query(
      `UPDATE user_group_members
       SET name = ?, surname = ?, phone = ?, city = ?, gender = ?, membership_date = ?,
           birth_date = ?, last_order_date = ?,
           custom1 = ?, custom2 = ?, custom3 = ?, custom4 = ?, custom5 = ?,
           custom6 = ?, custom7 = ?, custom8 = ?, custom9 = ?, custom10 = ?,
           custom11 = ?, custom12 = ?, custom13 = ?
       WHERE id = ? AND group_id = ?`,
      [
        name, surname, phone, city, gender, membershipDate,
        birthDate, lastOrderDate,
        custom1, custom2, custom3, custom4, custom5,
        custom6, custom7, custom8, custom9, custom10,
        custom11, custom12, custom13,
        personId, groupId
      ]
    );
    return res.json({ message: 'Kişi güncellendi' });
  } catch (err) {
    console.error('updatePersonInGroup error:', err.message);
    return res.status(500).json({ error: 'Kişi güncellenemedi' });
  }
};

// ✅ /auth/settings placeholder endpoint
exports.getSettingsPage = async (req, res) => {
  return res.json({ message: 'Settings endpoint is working.' });
};


// =======================
// Yardımcı Fonksiyon: Tekil Mesaj Gönderimi
// =======================
/**
 * Bir üyeye mesaj gönderir.
 * Mevcut tekil mesaj gönderme logic'inizi buraya ekleyin.
 * @param {string} phone - Üyenin telefon numarası
 * @param {string} message - Gönderilecek mesaj
 * @returns {Promise<any>}
 */
async function sendMessageToMember(phone, message) {
  // TODO: Buraya mevcut tekil mesaj gönderme logic'inizi ekleyin.
  // Örnek: SMS API çağrısı veya DB kaydı vs.
  // Aşağıdaki satırı kendi logic'inizle değiştirin:
  console.log(`[sendMessageToMember] ${phone} numarasına mesaj gönderiliyor: "${message}"`);
  // Örneğin:
  // await smsApi.send({ to: phone, body: message });
  return true;
}

// Eğer başka dosyada kullanılacaksa exports ile dışa aktar:

exports.sendMessageToMember = sendMessageToMember;

// ✅ Mesaj gönderme limitini getir (camelCase + snake_case uyumlu dön)
exports.getMessageRateLimit = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      'SELECT message_rate_limit FROM users WHERE id = ?',
      [userId]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    const value = Number(result[0].message_rate_limit);
    return res.json({
      messageRateLimit: value,          // frontend (camelCase)
      message_rate_limit: value         // backend/backward compatibility (snake_case)
    });
  } catch (err) {
    console.error('getMessageRateLimit error:', err.message);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
};

// ✅ Mesaj gönderme limitini güncelle (hem messageRateLimit hem message_rate_limit kabul edilir)
exports.updateMessageRateLimit = async (req, res) => {
  try {
    const userId = req.user.id;
    // Hem camelCase hem snake_case desteği
    const raw =
      req.body.message_rate_limit !== undefined
        ? req.body.message_rate_limit
        : req.body.messageRateLimit;

    const value = Number(raw);

    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({
        error: 'Geçerli bir sayı giriniz (1 ve üzeri).',
        received: raw
      });
    }

    await db.query(
      'UPDATE users SET message_rate_limit = ? WHERE id = ?',
      [value, userId]
    );

    return res.json({ message: 'Mesaj limiti güncellendi', messageRateLimit: value });
  } catch (err) {
    console.error('updateMessageRateLimit error:', err.message);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
};