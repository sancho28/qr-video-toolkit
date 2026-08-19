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
    const { fileName } = await downloadMedia(url, format, videoQuality || undefined);
    await pool.query('UPDATE downloads SET file_name = ?, status = ? WHERE id = ?', [fileName, 'done', recordId]);
    res.json({ file_url: `/api/download/file/${fileName}` });
  } catch (err) {
    await pool.query('UPDATE downloads SET status = ? WHERE id = ?', ['failed', recordId]);
    res.status(500).json({ message: err.message });
  }
});

// เสิร์ฟไฟล์วิดีโอ/เสียงที่ดาวน์โหลดเสร็จแล้ว เป็น attachment (บังคับ download
// แทนการเล่นในเบราว์เซอร์)
router.get('/file/:fileName', (req, res) => {
  res.download(path.join(DOWNLOAD_DIR, req.params.fileName));
});

router.get('/history', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, source_url, format, quality, status, created_at FROM downloads ORDER BY id DESC LIMIT 20',
  );
  res.json(rows);
});

module.exports = router;
