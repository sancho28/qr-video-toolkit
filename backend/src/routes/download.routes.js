const express = require('express');
const path = require('path');
const { downloadMedia, DOWNLOAD_DIR } = require('../services/download.service');
const { pool } = require('../db');

const router = express.Router();

// ดาวน์โหลด+แปลงไฟล์แบบ synchronous (พอสำหรับคลิปสั้นๆ ในการสาธิต — ถ้าจะ
// ใช้จริงกับคลิปยาว ควรทำเป็น background job + websocket แจ้ง progress แทน)
router.post('/', async (req, res) => {
  const { url, format } = req.body || {};
  if (!url || !['video', 'audio'].includes(format)) {
    return res.status(400).json({ message: 'ต้องระบุ url และ format เป็น "video" หรือ "audio"' });
  }

  const [insertResult] = await pool.query(
    'INSERT INTO downloads (source_url, format, status) VALUES (?, ?, ?)',
    [url, format, 'pending'],
  );
  const recordId = insertResult.insertId;

  try {
    const { fileName } = await downloadMedia(url, format);
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
    'SELECT id, source_url, format, status, created_at FROM downloads ORDER BY id DESC LIMIT 20',
  );
  res.json(rows);
});

module.exports = router;
