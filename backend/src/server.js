require('dotenv').config();
const express = require('express');
const { ensureSchemaWithRetry } = require('./db');
const qrRoutes = require('./routes/qr.routes');
const downloadRoutes = require('./routes/download.routes');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/qr', qrRoutes);
app.use('/api/download', downloadRoutes);

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // รอ+ตั้งค่า schema ให้พร้อมก่อนเปิดรับ request จริง
  await ensureSchemaWithRetry();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`qr-video-backend listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap ล้มเหลว:', err);
  process.exit(1);
});
