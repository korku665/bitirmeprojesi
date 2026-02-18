// Tekli mesaj gönderme (rapor ve sayaç için)
async function sendSingleMessage(req, res) {
  try {
    const { instanceName, number, message } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const userId = req.user && req.user.id ? req.user.id : req.userId;
    if (!instanceName || !number || !message) {
      return res.status(400).json({ error: 'Eksik parametreler.' });
    }
    // Rapor oluştur
    const now = new Date();
    // Tekli gönderimlerde raporlar listesinde görünmemesi için is_single alanı ekleniyor (varsa)
    const reportResult = await db.query(
      'INSERT INTO message_reports (user_id, sent_at, total_recipients, delivered_count, failed_count, read_count, is_single) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, now, 1, 0, 0, 0, 1]
    );
    const reportId = reportResult.insertId;
    await db.query(
      'INSERT INTO messages (user_id, phone, message, status, sent_at, report_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, number, message, 'pending', null, reportId]
    );
    // Mesajı gönder
    let status = 'failed';
    let sentAt = new Date();
    try {
      const payload = JSON.stringify({
        jid: `${number}@c.us`,
        number: number,
        text: message
      });
      const headers = { apikey: token, 'Content-Type': 'application/json' };
      const response = await httpPost(`${evoApiBaseUrl}/message/sendText/${instanceName}`, payload, headers);
      sentAt = new Date();
      if (response.status >= 200 && response.status < 300) {
        status = 'sent';
      }
    } catch (err) {}
    // Mesajı güncelle
    await db.query(
      'UPDATE messages SET status = ?, sent_at = ? WHERE phone = ? AND status = ? AND report_id = ? ORDER BY id DESC LIMIT 1',
      [status, sentAt, number, 'pending', reportId]
    );
    // Raporu güncelle
    await db.query(
      'UPDATE message_reports SET delivered_count = ?, failed_count = ? WHERE id = ?',
      [status === 'sent' ? 1 : 0, status === 'sent' ? 0 : 1, reportId]
    );
    await updateReportEndTime(reportId);
    return res.json({ message: status === 'sent' ? 'Mesaj gönderildi' : 'Mesaj gönderilemedi', status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
// Çoklu mesaj gönderme (kişiler listesiyle)
async function sendMultiMessages(req, res) {
  try {
    const { instanceName, members, message } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    // Kullanıcıyı bulmak için userId
    const userId = req.user && req.user.id ? req.user.id : req.userId;
    if (!instanceName || !message || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'Eksik parametreler.' });
    }
    let success = 0, fail = 0;
    const now = new Date();
    // Rapor oluştur
    const reportResult = await db.query(
      'INSERT INTO message_reports (user_id, sent_at, total_recipients, delivered_count, failed_count, read_count, is_single, is_multi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, now, members.length, 0, 0, 0, 0, 1]
    );
    const reportId = reportResult.insertId;
    // Sadece seçilen kişileri kaydet
    const insertPendingPromises = members.map(member => {
      const number = member.phone || member.telefon || member.gsm || member.number;
      // Sadece seçilen kişilerin bilgileri
      // Normalize name/surname using multiple possible keys
      const nameVal = member.name || member.isim || member.fullName || member.ad || member.firstName || member.firstname || '';
      const surnameVal = member.surname || member.soyad || member.lastName || member.lastname || '';
      return db.query(
        'INSERT INTO messages (user_id, phone, name, surname, message, status, sent_at, report_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, number, nameVal, surnameVal, message, 'pending', null, reportId]
      );
    });
    await Promise.all(insertPendingPromises);
    // Mesajları gönder
    let idx = 0;
    for (const member of members) {
      idx++;
      const number = member.phone || member.telefon || member.gsm || member.number;
      if (!number) continue;
      const personalizedMsg = replacePlaceholders(message, member);
      // Log sending with display name
      const displayName = (member.name || member.isim || member.fullName || member.ad || member.firstName || '').toString().trim();
      const displaySurname = (member.surname || member.soyad || member.lastName || '').toString().trim();
      const display = ((displayName || displaySurname) ? `${displayName} ${displaySurname}`.trim() : '');
      console.log(`${idx}. mesaj ${number} (${display}) numarasına gönderiliyor.`);
      try {
        const payload = JSON.stringify({
          jid: `${number}@c.us`,
          number: number,
          text: personalizedMsg
        });
        const headers = { apikey: token, 'Content-Type': 'application/json' };
        const response = await httpPost(`${evoApiBaseUrl}/message/sendText/${instanceName}`, payload, headers);
        const sentAt = new Date();
        if (response.status >= 200 && response.status < 300) {
          success++;
          await db.query(
            'UPDATE messages SET status = ?, sent_at = ?, message = ? WHERE phone = ? AND status = ? AND report_id = ? ORDER BY id DESC LIMIT 1',
            ['sent', sentAt, personalizedMsg, number, 'pending', reportId]
          );
        } else {
          fail++;
          await db.query(
            'UPDATE messages SET status = ?, sent_at = ?, message = ? WHERE phone = ? AND status = ? AND report_id = ? ORDER BY id DESC LIMIT 1',
            ['failed', sentAt, personalizedMsg, number, 'pending', reportId]
          );
        }
      } catch (err) {
        fail++;
        const errorTime = new Date();
        await db.query(
          'UPDATE messages SET status = ?, sent_at = ?, message = ? WHERE phone = ? AND status = ? AND report_id = ? ORDER BY id DESC LIMIT 1',
          ['failed', errorTime, personalizedMsg, number, 'pending', reportId]
        );
      }
    }
    // Raporu güncelle
    await db.query(
      'UPDATE message_reports SET delivered_count = ?, failed_count = ? WHERE id = ?',
      [success, fail, reportId]
    );
    await updateReportEndTime(reportId);
    return res.json({ message: 'Çoklu mesaj gönderimi tamamlandı', success, fail });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
const http = require('http');
const https = require('https');
const evoApiBaseUrl = "http://localhost:8080";
const db = require('../config/db'); // DB bağlantısı

const TEST_MODE_ENABLED = false; // backend üzerinden test modunu aç/kapat

// Helper: POST with node http/https (avoids node-fetch / dynamic imports)
function httpPost(fullUrl, body, headers = {}) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(fullUrl);
      const lib = urlObj.protocol === 'https:' ? https : http;
      const options = {
        method: 'POST',
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + (urlObj.search || ''),
        headers: Object.assign({
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body || '')
        }, headers)
      };

      const req = lib.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const resBody = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode, body: resBody, headers: res.headers });
        });
      });

      req.on('error', (err) => reject(err));
      if (body) req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Kişisel alanları dolduran fonksiyon
function replacePlaceholders(template, person) {
    let msg = template;
    if (!person || typeof person !== 'object') return msg;
    // Tarih formatlama
    function formatDateNoTZ(dateVal) {
      if (!dateVal) return '';

      // Eğer Date objesi geldiyse stringe çevir
      if (dateVal instanceof Date) {
        const year = dateVal.getFullYear();
        const month = String(dateVal.getMonth() + 1).padStart(2, '0');
        const day = String(dateVal.getDate()).padStart(2, '0');
        return `${day}.${month}.${year}`;
      }

      // Eğer string geldiyse eski mantıkla devam et
      if (typeof dateVal === 'string') {
        const parts = dateVal.split('T')[0].split('-');
        if (parts.length === 3) {
          return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return dateVal;
      }

      // Tanınmayan tip
      return '';
    }
    const formattedBirth = formatDateNoTZ(person.birthDate || person.birth_date);
    const formattedMembership = formatDateNoTZ(person.membershipDate || person.membership_date);
    const formattedLastOrder = formatDateNoTZ(person.lastOrderDate || person.last_order_date);
    for (const key of Object.keys(person)) {
        let aliases = [key];
        switch (key.toLowerCase()) {
            case 'name': aliases.push('isim'); break;
            case 'surname': aliases.push('soyisim'); break;
            case 'phone': aliases.push('telefon'); break;
            case 'city': aliases.push('şehir'); break;
            case 'gender': aliases.push('cinsiyet'); break;
            case 'membershipdate':
            case 'membership_date': aliases.push('üyeliktarihi'); break;
            case 'birthdate':
            case 'birth_date': aliases.push('doğumtarihi'); break;
            case 'lastorderdate':
            case 'last_order_date': aliases.push('sonsipariştarihi'); break;
            default:
                const customMatch = key.match(/^custom(\d+)$/i);
                if (customMatch) {
                    aliases.push('özelalan' + customMatch[1]);
                }
                break;
        }
        for (const alias of aliases) {
            const re = new RegExp(`%%${alias}%%`, 'gi');
            let value = person[key];
            if (alias.toLowerCase() === 'doğumtarihi') value = formattedBirth;
            if (alias.toLowerCase() === 'üyeliktarihi') value = formattedMembership;
            if (alias.toLowerCase() === 'sonsipariştarihi') value = formattedLastOrder;
            if ([
                'birthdate', 'birth_date',
                'membershipdate', 'membership_date',
                'lastorderdate', 'last_order_date'
            ].includes(key.toLowerCase())) {
                value = formatDateNoTZ(person[key]);
            }
            msg = msg.replace(re, value == null ? '' : value);
        }
    }
    msg = msg.replace(/%%doğumtarihi%%/gi, formattedBirth);
    msg = msg.replace(/%%üyeliktarihi%%/gi, formattedMembership);
    msg = msg.replace(/%%sonsipariştarihi%%/gi, formattedLastOrder);
    return msg;
}

// Kullanıcının mesaj limiti bilgisini döndüren fonksiyon (PostgreSQL)
async function getUserMessageLimit(req) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) {
      return { error: 'Token eksik.' };
    }

    const rows = await db.query(
      'SELECT message_rate_limit FROM users WHERE user_token = ? LIMIT 1',
      [token]
    );

    console.log("DEBUG - Query rows:", rows);

    if (!rows || rows.length === 0) {
      return { error: 'Kullanıcı bulunamadı.' };
    }
    return { message_rate_limit: rows[0].message_rate_limit };
  } catch (err) {
    return { error: 'Hata: ' + err.message };
  }
}

// REVİZE: send_end_time güncellemesi
async function updateReportEndTime(reportId) {
    const endTime = new Date();
    try {
        await db.query(
            'UPDATE message_reports SET send_end_time = ? WHERE id = ?',
            [endTime, reportId]
        );
        console.log('send_end_time güncellendi:', endTime);
    } catch (err) {
        console.error('send_end_time güncellenirken hata oluştu:', err);
    }
}

// Toplu mesaj gönderme controller
async function sendBulkMessages(req, res) {
  try {
    const { instanceName, groupId, numbers, message, testMode } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    // Extract userId from req.user.id or fallback to req.userId
    const userId = req.user && req.user.id ? req.user.id : req.userId;
    if (!instanceName || !message || (!groupId && (!numbers || numbers.length === 0))) {
      return res.status(400).json({ error: 'Eksik parametreler.' });
    }
    console.log("DEBUG - Incoming Authorization header:", req.headers.authorization);
    const limitData = await getUserMessageLimit(req);
    console.log("DEBUG - Result from getUserMessageLimit:", limitData);
    const messageLimit = limitData?.message_rate_limit;
    if (!messageLimit || Number(messageLimit) <= 0) {
      return res.status(403).json({ error: 'Mesaj limiti ayarlanmamış.' });
    }
    let bulkRecipients = [];
    if (groupId) {
      const persons = await db.query(
        `SELECT 
           phone,
           name,
           surname,
           birth_date,
           membership_date,
           city,
           gender,
           last_order_date,
           custom1, custom2, custom3, custom4, custom5,
           custom6, custom7, custom8, custom9, custom10,
           custom11, custom12, custom13
         FROM user_group_members
         WHERE group_id = ?`,
        [groupId]
      );
      bulkRecipients = (persons || []).filter(person => person.phone);
    } else {
      // numbers can be either an array of phone strings OR an array of objects { phone, name, surname, ... }
      const list = Array.isArray(numbers)
        ? numbers
        : String(numbers || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

      // Collect object entries directly, and gather plain phone strings to lookup in DB
      const recipients = [];
      const phonesToLookup = [];
      list.forEach(item => {
        if (item && typeof item === 'object') {
          const phoneVal = (item.phone || item.telefon || item.gsm || item.number || '').toString().trim();
          const nameVal = item.name || item.isim || item.fullName || item.ad || item.firstName || item.firstname || null;
          const surnameVal = item.surname || item.soyad || item.lastName || item.lastname || null;
          recipients.push({ phone: phoneVal, name: nameVal, surname: surnameVal, ...item });
        } else {
          const phone = String(item || '').trim();
          if (phone) phonesToLookup.push(phone);
        }
      });

      if (phonesToLookup.length > 0) {
        // Query user_group_members for any matching phones so we can use custom fields/placeholders
        try {
          const placeholders = phonesToLookup.map(() => '?').join(',');
          const rows = await db.query(
            `SELECT phone, name, surname, birth_date, membership_date, city, gender, last_order_date,
                    custom1, custom2, custom3, custom4, custom5, custom6, custom7, custom8, custom9, custom10,
                    custom11, custom12, custom13
             FROM user_group_members WHERE phone IN (${placeholders})`,
            phonesToLookup
          );
          const map = {};
          (rows || []).forEach(r => { if (r && r.phone) map[String(r.phone).trim()] = r; });
          phonesToLookup.forEach(p => {
            const found = map[p];
            if (found) recipients.push(found);
            else recipients.push({ phone: p, name: null, surname: null });
          });
        } catch (lookupErr) {
          // If lookup fails, fall back to plain phone entries (placeholders will be empty)
          phonesToLookup.forEach(p => recipients.push({ phone: p, name: null, surname: null }));
        }
      }

      bulkRecipients = recipients.filter(r => r && r.phone);
    }
    if (!bulkRecipients || bulkRecipients.length === 0) {
      return res.status(400).json({ error: 'Geçerli alıcı bulunamadı.' });
    }
    // Mesaj zamanlaması: periyot bazlı
    const messagesPerHour = Number(messageLimit);
    const totalSeconds = 3600;
    let slotDuration = totalSeconds / messagesPerHour;
    const effectiveTestMode = TEST_MODE_ENABLED || testMode;

    // Initialize counters for report
    let deliveredCount = 0;
    let failedCount = 0;

    if (effectiveTestMode) slotDuration = 5;

    const now = new Date();

    // Create a single message report for this bulk send, include send_start_time and user_id
    const reportResult = await db.query(
      'INSERT INTO message_reports (user_id, sent_at, total_recipients, delivered_count, failed_count, read_count, is_single, is_multi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, now, bulkRecipients.length, 0, 0, 0, 0, 0]
    );
    const reportId = reportResult.insertId;

    // Insert initial pending messages for all recipients with the single reportId and user_id
    const insertPendingPromises = bulkRecipients.map(person => {
      return db.query(
        'INSERT INTO messages (user_id, phone, name, surname, message, status, sent_at, report_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, person.phone, person.name || null, person.surname || null, message, 'pending', null, reportId]
      );
    });
    await Promise.all(insertPendingPromises);

    bulkRecipients.forEach((person, i) => {
      let periodIndex, periodStart, randomSecondInPeriod, sendAt;
      if (effectiveTestMode) {
        periodIndex = Math.floor(i / 1);
        periodStart = periodIndex * 1;
        randomSecondInPeriod = Math.floor(Math.random() * 1);
        sendAt = periodStart + randomSecondInPeriod;
      } else {
        periodIndex = Math.floor(i / 1);
        periodStart = periodIndex * slotDuration;
        randomSecondInPeriod = Math.floor(Math.random() * slotDuration);
        sendAt = periodStart + randomSecondInPeriod;
      }
      // Log scheduling
      const scheduledTime = `${Math.floor(sendAt/60)}.dakika ${Math.floor(sendAt%60)}.saniye`;
      const displayName = (person.name || person.isim || person.fullName || person.ad || person.firstName || '').toString().trim();
      const displaySurname = (person.surname || person.soyad || person.lastName || '').toString().trim();
      const display = ((displayName || displaySurname) ? `${displayName} ${displaySurname}`.trim() : '');
      console.log(`${i+1}. mesaj ${person.phone} (${display}) numarasına ${scheduledTime} sonra gönderilecek.`);
      setTimeout(async () => {
        const personalizedMsg = replacePlaceholders(message, person);
        try {
          const payload = JSON.stringify({
            jid: `${person.phone}@c.us`,
            number: person.phone,
            text: personalizedMsg
          });
          const headers = { apikey: token, 'Content-Type': 'application/json' };
          const response = await httpPost(`${evoApiBaseUrl}/message/sendText/${instanceName}`, payload, headers);
          const data = response.body;
          const sentAt = new Date();
          if (response.status < 200 || response.status >= 300) {
            failedCount++;
            await db.query(
              'UPDATE messages SET status = ?, sent_at = ?, message = ? WHERE phone = ? AND status = ? AND report_id = ? ORDER BY id DESC LIMIT 1',
              ['failed', sentAt, personalizedMsg, person.phone, 'pending', reportId]
            );
          } else {
            deliveredCount++;
            await db.query(
              'UPDATE messages SET status = ?, sent_at = ?, message = ? WHERE phone = ? AND status = ? AND report_id = ? ORDER BY id DESC LIMIT 1',
              ['sent', sentAt, personalizedMsg, person.phone, 'pending', reportId]
            );
          }
        } catch (err) {
          failedCount++;
          const errorTime = new Date();
          await db.query(
            'UPDATE messages SET status = ?, sent_at = ?, message = ? WHERE phone = ? AND status = ? AND report_id = ? ORDER BY id DESC LIMIT 1',
            ['failed', errorTime, personalizedMsg, person.phone, 'pending', reportId]
          );
        }

        // Eğer son mesaj ise raporu güncelle
        if (i === bulkRecipients.length - 1) {
            await updateReportEndTime(reportId);
          try {
            await db.query(
              'UPDATE message_reports SET delivered_count = ?, failed_count = ? WHERE id = ?',
              [deliveredCount, failedCount, reportId]
            );
          } catch (reportErr) {}
        }
      }, sendAt * 1000);
    });
    return res.json({ message: 'Toplu mesaj gönderimi başlatıldı', count: bulkRecipients.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { sendBulkMessages, sendMultiMessages, sendSingleMessage };
