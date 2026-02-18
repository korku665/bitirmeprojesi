// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Bağlantı testi
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL bağlantısı başarılı!");
    const [rows] = await connection.query("SELECT 1 + 1 AS result");
    console.log("Test sorgusu sonucu:", rows[0].result); // 2 çıkmalı
    connection.release();
  } catch (err) {
    console.error("❌ MySQL bağlantı hatası:", err.message);
  }
})();

module.exports = {
  query: async (sql, params) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
};