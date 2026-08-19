const express = require('express');
const path = require('path');
const { downloadMedia, DOWNLOAD_DIR, VIDEO_QUALITIES } = require('../services/download.service');
const { pool } = require('../db');

const router = express.Router();

// ดาวน์โหลด+แปลงไฟล์แบบ synchronous (พอสำหรับคลิปสั้นๆ ในการสาธิต — ถ้าจะ
// ใช้จริงกับคลิปยาว ควรทำเป็น background job + websocket แจ้ง progress แทน)
router.post('/', async (req, res) => {
  const { url, format, quality } = req.body || {};
  if (!url || !['video', 'audio'].includes(format)) {
    return res.status(400).json({ message: 'ต้องระบุ url และ format เป็น "video" หรือ "audio"' });
  }
  // quality มีความหมายเฉพาะตอน format='video' — ถ้าไม่ส่งมาใช้ 'best' เป็นค่า
  // default (เท่ากับพฤติกรรมเดิมก่อนมีฟีเจอร์นี้)
  const videoQuality = format === 'video' ? quality || 'best' : null;
  if (format === 'video' && !Object.prototype.hasOwnProperty.call(VIDEO_QUALITIES, videoQuality)) {
    return res.status(400).json({ message: `quality ต้องเป็นหนึ่งใน: ${Object.keys(VIDEO_QUALITIES).join(', ')}` });
  }

  const [insertResult] = await pool.query(
    'INSERT INTO downloads (source_url, format, quality, status) VALUES (?, ?, ?, ?)',
    [url, format, videoQuality, 'pending'],
  );
  const recordId = insertResult.insertId;

  try {
    const { fileName, title } = await downloadMedia(url, format, videoQuality || undefined);
    await pool.query('UPDATE downloads SET file_name = ?, title = ?, status = ? WHERE id = ?', [fileName, title, 'done', recordId]);
    res.json({ file_url: `/api/download/file/${fileName}` });
  } catch (err) {
    await pool.query('UPDATE downloads SET status = ? WHERE id = ?', ['failed', recordId]);
    res.status(500).json({ message: err.message });
  }
});

// เสิร์ฟไฟล์วิดีโอ/เสียงที่ดาวน์โหลดเสร็จแล้ว เป็น attachment (บังคับ download
// แทนการเล่นในเบราว์เซอร์) — ไฟล์บนดิสก์ชื่อเป็น UUID เสมอ (กันชื่อชนกัน/
// อักขระแปลกๆ) แต่ถ้ามีชื่อวิดีโอจริงเก็บไว้ใน DB จะสั่งให้เบราว์เซอร์ save
// เป็นชื่อนั้นแทนผ่าน Content-Disposition (อาร์กิวเมนต์ที่ 2 ของ res.download)
router.get('/file/:fileName', async (req, res) => {
  const { fileName } = req.params;
  const [rows] = await pool.query('SELECT title FROM downloads WHERE file_name = ? LIMIT 1', [fileName]);
  const title = rows[0]?.title;
  const filePath = path.join(DOWNLOAD_DIR, fileName);
  if (title) {
    return res.download(filePath, `${title}${path.extname(fileName)}`);
  }
  res.download(filePath);
});

router.get('/history', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, source_url, format, quality, status, file_name, created_at FROM downloads ORDER BY id DESC LIMIT 20',
  );
  res.json(rows);
});

module.exports = router;
