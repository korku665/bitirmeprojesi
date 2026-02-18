const db = require('../config/db');
// Kullanıcıya özel dashboard istatistikleri
exports.getUserDashboardStats = async (req, res) => {
  try {
    const userId = (req.user && req.user.id) ? req.user.id : req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }


  // Toplam grup sayısı
  const [{ group_count }] = await db.query('SELECT COUNT(*) AS group_count FROM user_groups WHERE user_id = ?', [userId]);

  // Gruplardaki toplam kişi sayısı
  const [{ total_members }] = await db.query('SELECT COUNT(*) AS total_members FROM user_group_members WHERE group_id IN (SELECT id FROM user_groups WHERE user_id = ?)', [userId]);

  // Gruplardaki benzersiz kişi sayısı (saf veri)
  const [{ unique_members }] = await db.query('SELECT COUNT(DISTINCT phone) AS unique_members FROM user_group_members WHERE group_id IN (SELECT id FROM user_groups WHERE user_id = ?) AND phone IS NOT NULL AND phone != ""', [userId]);

  // Toplam mesaj
  const [{ total_messages }] = await db.query('SELECT COUNT(*) AS total_messages FROM messages WHERE user_id = ?', [userId]);

  // Toplam rapor
  const [{ total_reports }] = await db.query('SELECT COUNT(*) AS total_reports FROM message_reports WHERE user_id = ?', [userId]);

  // Başarılı mesaj
  const [{ sent_messages }] = await db.query('SELECT COUNT(*) AS sent_messages FROM messages WHERE user_id = ? AND status = "sent"', [userId]);

  // Başarısız mesaj
  const [{ failed_messages }] = await db.query('SELECT COUNT(*) AS failed_messages FROM messages WHERE user_id = ? AND status = "failed"', [userId]);

  // En büyük grup (üye sayısı en fazla olan)
  const biggestGroupArr = await db.query(`
    SELECT g.id, g.name, IFNULL(COUNT(m.id),0) AS member_count
    FROM user_groups g
    LEFT JOIN user_group_members m ON g.id = m.group_id
    WHERE g.user_id = ?
    GROUP BY g.id, g.name
    ORDER BY member_count DESC
    LIMIT 1
  `, [userId]);
  const biggestGroup = biggestGroupArr && biggestGroupArr.length > 0 ? biggestGroupArr[0] : null;

  // Son 7 gün mesaj trafiği (günlük)
  const last7Days = await db.query('SELECT DATE(sent_at) as day, COUNT(*) as sent_count FROM messages WHERE user_id = ? AND status = "sent" AND sent_at >= CURDATE() - INTERVAL 7 DAY GROUP BY day ORDER BY day DESC', [userId]);

  // Saat başına gönderilecek mesaj adedi (kullanıcı limiti)
  const [{ message_rate_limit }] = await db.query('SELECT message_rate_limit FROM users WHERE id = ?', [userId]);

  // Bugün gönderilen
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const [{ sent_today }] = await db.query('SELECT COUNT(*) AS sent_today FROM messages WHERE user_id = ? AND status = "sent" AND DATE(sent_at) = ?', [userId, todayStr]);

    res.json({
      group_count,
      total_members,
      unique_members,
      total_messages,
      total_reports,
      sent_messages,
      failed_messages,
  biggest_group: biggestGroup,
      last7_days: last7Days,
      message_rate_limit,
      sent_today
    });
  } catch (err) {
    console.error("Error in getUserDashboardStats:", err);
    res.status(500).json({ error: err.message, logs: { message: "Error occurred in getUserDashboardStats" } });
  }
};
// Bugün gönderilen ve başarılı olan mesajların sayısı
exports.getTodaySentCount = async (req, res) => {
  try {
    const userId = (req.user && req.user.id) ? req.user.id : req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    // Bugünün tarihi (Y-m-d)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    // Sorgu: Bugün atılan ve başarılı (sent) olan mesajlar
    const query = `SELECT COUNT(*) AS count FROM messages WHERE user_id = ? AND status = 'sent' AND DATE(sent_at) = ?`;
    const rows = await db.query(query, [userId, todayStr]);
    const count = Array.isArray(rows) && rows[0] ? rows[0].count : 0;
    res.json({ count });
  } catch (err) {
    console.error("Error in getTodaySentCount:", err);
    res.status(500).json({ error: err.message, logs: { message: "Error occurred in getTodaySentCount" } });
  }
};

// Gönderim raporları
exports.getSentReports = async (req, res) => {
  try {
    const userId = (req.user && req.user.id) ? req.user.id : req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    let offset = (page - 1) * limit;

    console.log("Fetching total count of `message_reports`...");
    const countResult = await db.query(
      "SELECT COUNT(*) AS total FROM `message_reports` WHERE user_id = ?",
      [userId]
    );
    const total = countResult && Array.isArray(countResult) && countResult[0] ? countResult[0].total : 0;
    const totalPages = Math.ceil(total / limit);
    console.log(`Total records: ${total}, Total pages: ${totalPages}`);

    console.log("Checking if send_end_time column exists...");
    const columnExistsQuery = `SHOW COLUMNS FROM \`message_reports\``;
    const columns = await db.query(columnExistsQuery);
    const hasSendEndTime = columns.some(col => col.Field === 'send_end_time');

    console.log("Fetching paginated `message_reports` data...");
    const dataQuery = `SELECT \
         mr.id,\
         DATE_FORMAT(mr.sent_at, '%d.%m.%Y') AS send_date,\
         DATE_FORMAT(mr.sent_at, '%H.%i') AS send_time,\
         ${hasSendEndTime ? "DATE_FORMAT(mr.send_end_time, '%H.%i') AS send_end_time," : ""}\
         (SELECT COUNT(*) FROM messages WHERE report_id = mr.id) AS total_recipients,\
         (SELECT COUNT(*) FROM messages WHERE report_id = mr.id AND LOWER(status) = 'sent') AS delivered_count,\
         (SELECT COUNT(*) FROM messages WHERE report_id = mr.id AND LOWER(status) = 'failed') AS failed_count,\
         mr.is_single, mr.is_multi\
       FROM \`message_reports\` mr\
       WHERE mr.user_id = ?\
       ORDER BY mr.sent_at DESC\
       LIMIT ${offset}, ${limit}`;

    console.log("Data Query:", dataQuery);

    const rows = await db.query(dataQuery, [userId]);
    const data = Array.isArray(rows) ? rows.map(row => {
      let sending_type = 'Toplu';
      if (row.is_multi === 1) {
        sending_type = 'Çoklu';
      } else if (row.is_single === 1) {
        sending_type = 'Tekli';
      }
      return {
        id: row.id,
        send_date: row.send_date || '',
        sending_type,
        send_time: row.send_time || '',
        send_end_time: row.send_end_time || '',
        total_recipients: row.total_recipients,
        delivered_count: row.delivered_count,
        failed_count: row.failed_count
      };
    }) : [];

    console.log("Fetched rows count:", data.length);
    res.json({ page, total, totalPages, data });
  } catch (err) {
    console.error("Error in getSentReports:", err);
    res.status(500).json({ error: err.message, logs: { message: "Error occurred in getSentReports" } });
  }
};

// Dashboard özet
exports.getSummary = async (req, res) => {
  try {
    const userId = (req.user && req.user.id) ? req.user.id : req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    const summaryQuery = `SELECT 
         COUNT(*) AS total_reports,
         SUM(IFNULL(total_recipients,0)) AS total_recipients,
         SUM(IFNULL(delivered_count,0)) AS total_delivered,
         SUM(IFNULL(failed_count,0)) AS total_failed
       FROM \`message_reports\`
       WHERE user_id = ?`;
    console.log("Summary Query:", summaryQuery);
    const rows = await db.query(summaryQuery, [userId]);
    const data = Array.isArray(rows) && rows[0] ? rows[0] : {};
    res.json({ data, logs: { query: summaryQuery } });
  } catch (err) {
    console.error("Error in getSummary:", err);
    res.status(500).json({ error: err.message, logs: { message: "Error occurred in getSummary" } });
  }
};

// Get Report Details
exports.getReportDetails = async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId = (req.user && req.user.id) ? req.user.id : req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    let type = req.query.type;
    console.log("Received getReportDetails request:", { reportId, type });

    if (!reportId) {
      return res.status(400).json({ error: "Missing reportId parameter" });
    }

    // Map 'recipients' to 'sent' for API compatibility
    if (type === 'recipients') type = 'sent';

    const allowedTypes = ['sent', 'delivered', 'failed'];
    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid or missing type parameter. Must be one of: sent, delivered, failed." });
    }

  // Sadece istenen tipteki kişilerin bilgileri (messages tablosundan)
  // type parametresi: sent, delivered, failed
  const statusMap = {
    sent: 'sent',
    delivered: 'sent',
    failed: 'failed'
  };
  const requestedStatus = statusMap[type] || 'sent';
  const detailsQuery = `SELECT m.id, m.phone, m.name, m.surname, m.message, m.status, m.sent_at FROM messages m WHERE m.report_id = ? AND m.user_id = ? AND LOWER(m.status) = ?`;
  const rows = await db.query(detailsQuery, [reportId, userId, requestedStatus]);
    const data = Array.isArray(rows) ? rows.map((row, index) => {
      let sent_at_formatted = '';
      if (row.sent_at) {
        const dateObj = new Date(row.sent_at);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        sent_at_formatted = `${day}.${month}.${year} ${hours}.${minutes}`;
      }
      return {
        "#": index + 1,
        id: row.id,
        phone: row.phone,
        name: row.name || '',
        surname: row.surname || '',
        message: row.message,
        status: row.status,
        sent_at: sent_at_formatted
      };
    }) : [];

    res.json({ page: 1, total: data.length, totalPages: 1, data });
  } catch (err) {
    console.error("Error in getReportDetails:", err);
    res.status(500).json({ error: err.message, logs: { message: "Error occurred in getReportDetails" } });
  }
};