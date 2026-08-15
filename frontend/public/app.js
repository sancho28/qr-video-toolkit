// เรียก '/api/...' แบบ relative path เสมอ — Caddy เป็นคนตัดสินใจว่าจะส่งไป
// container ไหน (frontend หรือ backend) ให้ browser เห็นแค่ origin เดียว

const qrBtn = document.getElementById('qr-btn');
const qrUrlInput = document.getElementById('qr-url');
const qrResult = document.getElementById('qr-result');

qrBtn.addEventListener('click', async () => {
  const url = qrUrlInput.value.trim();
  if (!url) return;

  qrResult.textContent = 'กำลังสร้าง...';
  try {
    const res = await fetch('/api/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'สร้าง QR ไม่สำเร็จ');
    qrResult.innerHTML = `<img src="${data.file_url}" alt="QR code" width="220" />`;
  } catch (err) {
    qrResult.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
  }
});

const dlBtn = document.getElementById('dl-btn');
const dlUrlInput = document.getElementById('dl-url');
const dlResult = document.getElementById('dl-result');

dlBtn.addEventListener('click', async () => {
  const url = dlUrlInput.value.trim();
  const format = document.querySelector('input[name="format"]:checked').value;
  if (!url) return;

  dlResult.textContent = 'กำลังดาวน์โหลด/แปลงไฟล์... (อาจใช้เวลาสักครู่ขึ้นอยู่กับความยาววิดีโอ)';
  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'ดาวน์โหลดไม่สำเร็จ');
    dlResult.innerHTML = `<a href="${data.file_url}" download>คลิกเพื่อดาวน์โหลดไฟล์</a>`;
  } catch (err) {
    dlResult.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
  }
});
