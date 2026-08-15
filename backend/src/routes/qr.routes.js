const express = require('express');
const path = require('path');
const { generateQr, QR_DIR } = require('../services/qr.service');
const { pool } = require('../db');

const router = express.Router();

// สร้าง QR code จาก URL ที่ส่งมา แล้วบันทึก log ลง MariaDB
router.post('/', async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ message: 'ต้องระบุ url' });
  }

  try {
    const { fileName } = await generateQr(url);
    await pool.query('INSERT INTO qr_codes (original_url, file_name) VALUES (?, ?)', [url, fileName]);
    res.json({ file_url: `/api/qr/file/${fileName}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// เสิร์ฟไฟล์รูป QR ที่สร้างไว้แล้ว
router.get('/file/:fileName', (req, res) => {
  res.sendFile(path.join(QR_DIR, req.params.fileName));
});

// ประวัติ QR ที่เคยสร้าง (เดโมง่ายๆ ว่า backend คุยกับ MariaDB จริง)
router.get('/history', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, original_url, file_name, created_at FROM qr_codes ORDER BY id DESC LIMIT 20',
  );
  res.json(rows);
});

module.exports = router;
