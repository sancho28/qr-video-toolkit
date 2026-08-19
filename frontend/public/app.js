// เรียก '/api/...' แบบ relative path เสมอ — Caddy เป็นคนตัดสินใจว่าจะส่งไป
// container ไหน (frontend หรือ backend) ให้ browser เห็นแค่ origin เดียว

const qrBtn = document.getElementById('qr-btn');
const qrUrlInput = document.getElementById('qr-url');
const qrResult = document.getElementById('qr-result');
const qrHistoryList = document.getElementById('qr-history');

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
    loadQrHistory();
  } catch (err) {
    qrResult.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
  }
});

async function loadQrHistory() {
  qrHistoryList.textContent = '';
  try {
    const res = await fetch('/api/qr/history');
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.message || 'โหลดประวัติไม่สำเร็จ');

    rows.forEach((row) => {
      const li = document.createElement('li');

      const link = document.createElement('a');
      link.href = `/api/qr/file/${row.file_name}`;
      link.textContent = row.original_url;
      link.target = '_blank';
      li.appendChild(link);

      const time = document.createElement('span');
      time.className = 'history-time';
      time.textContent = ` — ${new Date(row.created_at).toLocaleString('th-TH')}`;
      li.appendChild(time);

      qrHistoryList.appendChild(li);
    });
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
    qrHistoryList.appendChild(li);
  }
}

const dlBtn = document.getElementById('dl-btn');
const dlUrlInput = document.getElementById('dl-url');
const dlResult = document.getElementById('dl-result');
const dlHistoryList = document.getElementById('dl-history');
const dlQualitySelect = document.getElementById('dl-quality');
const formatRadios = document.querySelectorAll('input[name="format"]');

// เลือกความชัดมีความหมายแค่ตอนดาวน์โหลดวิดีโอ — ซ่อน dropdown เวลาเลือก
// "เสียงเท่านั้น" เพื่อไม่ให้ผู้ใช้เข้าใจผิดว่า mp3 เลือกความชัดได้
function syncQualityVisibility() {
  const format = document.querySelector('input[name="format"]:checked').value;
  dlQualitySelect.style.display = format === 'video' ? '' : 'none';
}
formatRadios.forEach((radio) => radio.addEventListener('change', syncQualityVisibility));
syncQualityVisibility();

dlBtn.addEventListener('click', async () => {
  const url = dlUrlInput.value.trim();
  const format = document.querySelector('input[name="format"]:checked').value;
  const quality = dlQualitySelect.value;
  if (!url) return;

  dlResult.textContent = 'กำลังดาวน์โหลด/แปลงไฟล์... (อาจใช้เวลาสักครู่ขึ้นอยู่กับความยาววิดีโอ)';
  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format, quality: format === 'video' ? quality : undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'ดาวน์โหลดไม่สำเร็จ');
    dlResult.innerHTML = `<a href="${data.file_url}" download>คลิกเพื่อดาวน์โหลดไฟล์</a>`;
    loadDlHistory();
  } catch (err) {
    dlResult.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
  }
});

async function loadDlHistory() {
  dlHistoryList.textContent = '';
  try {
    const res = await fetch('/api/download/history');
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.message || 'โหลดประวัติไม่สำเร็จ');

    rows.forEach((row) => {
      const li = document.createElement('li');

      const label = document.createElement(row.status === 'done' ? 'a' : 'span');
      if (row.status === 'done') {
        label.href = `/api/download/file/${row.file_name}`;
      }
      const qualitySuffix = row.quality ? ` ${row.quality === 'best' ? 'best' : row.quality + 'p'}` : '';
      label.textContent = `[${row.format}${qualitySuffix}] ${row.source_url}`;
      li.appendChild(label);

      const status = document.createElement('span');
      status.className = `history-status history-status--${row.status}`;
      status.textContent = ` (${row.status})`;
      li.appendChild(status);

      const time = document.createElement('span');
      time.className = 'history-time';
      time.textContent = ` — ${new Date(row.created_at).toLocaleString('th-TH')}`;
      li.appendChild(time);

      dlHistoryList.appendChild(li);
    });
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
    dlHistoryList.appendChild(li);
  }
}

loadQrHistory();
loadDlHistory();
