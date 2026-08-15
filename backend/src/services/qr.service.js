const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const QR_DIR = path.join(__dirname, '..', 'qrcodes');
fs.mkdirSync(QR_DIR, { recursive: true });

// สร้างไฟล์ QR code เป็น PNG แล้วคืน id/ชื่อไฟล์ให้ route ไปบันทึกลง DB ต่อ
async function generateQr(targetUrl) {
  const id = randomUUID();
  const fileName = `${id}.png`;
  const filePath = path.join(QR_DIR, fileName);
  await QRCode.toFile(filePath, targetUrl, { width: 400, margin: 2 });
  return { id, fileName };
}

module.exports = { generateQr, QR_DIR };
