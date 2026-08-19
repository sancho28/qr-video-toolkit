const mysql = require('mysql2/promise');

// pool เดียวใช้ร่วมกันทั้งแอป — mysql2 จัดการ connection reuse/queueing ให้เอง
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// สร้างตารางแบบ idempotent (IF NOT EXISTS) — รันซ้ำได้ทุกครั้งที่ container
// เริ่มโดยไม่ error และไม่ทำข้อมูลเดิมหาย
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      original_url VARCHAR(2048) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_url VARCHAR(2048) NOT NULL,
      format ENUM('video', 'audio') NOT NULL,
      file_name VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ALTER ... ADD COLUMN IF NOT EXISTS เป็น syntax เฉพาะ MariaDB — ทำให้รันซ้ำ
  // ได้แบบ idempotent เหมือน CREATE TABLE IF NOT EXISTS ด้านบน (จำเป็นเพราะ
  // ตาราง downloads อาจมีอยู่แล้วจาก volume เดิมก่อนเพิ่มคอลัมน์นี้)
  await pool.query(`
    ALTER TABLE downloads ADD COLUMN IF NOT EXISTS quality VARCHAR(10) DEFAULT NULL
  `);

  // เก็บชื่อวิดีโอจริง (ได้จาก yt-dlp ตอนดาวน์โหลด) แยกจาก file_name ที่เป็น
  // UUID บนดิสก์ — ใช้ตั้งชื่อไฟล์ตอนเสิร์ฟให้ผู้ใช้ดาวน์โหลด (ดู download.routes.js)
  await pool.query(`
    ALTER TABLE downloads ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT NULL
  `);
}

// MariaDB อาจยัง initialize ไม่เสร็จตอน backend เริ่มรัน แม้ depends_on จะรอ
// healthcheck แล้วก็ตาม (เผื่อกรณี edge case) จึง retry เป็นชั้นป้องกันซ้ำ
async function ensureSchemaWithRetry(retries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await ensureSchema();
      console.log('เชื่อมต่อฐานข้อมูลสำเร็จ และตรวจสอบ schema เรียบร้อย');
      return;
    } catch (err) {
      console.log(`DB ยังไม่พร้อม (ครั้งที่ ${attempt}/${retries}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('เชื่อมต่อฐานข้อมูลไม่สำเร็จหลังจากลองครบจำนวนครั้งที่กำหนด');
}

module.exports = { pool, ensureSchemaWithRetry };
