const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const DOWNLOAD_DIR = path.join(__dirname, '..', '..', 'downloads');
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// หมายเหตุการใช้งาน: ใช้ดาวน์โหลดเฉพาะวิดีโอที่มีสิทธิ์ใช้งาน/เผยแพร่ซ้ำได้
// (เช่นคลิปของตัวเอง, Creative Commons, หรือเนื้อหาที่แพลตฟอร์มต้นทางอนุญาต)
// เคารพ Terms of Service ของเว็บไซต์ต้นทางเสมอ

// จำกัด retry/timeout ไว้ไม่ให้ค้างนานเกินไป — ค่า default ของ yt-dlp คือ
// retries=10 + fragment-retries=10 พร้อม exponential backoff ซึ่งถ้าต้นทาง
// บล็อก (เช่น 403 จาก bot-detection) จะค้างได้นานหลายนาทีโดยไม่มีอะไรคืบหน้า
// เลย ค่าที่ตั้งนี้ทำให้ fail ภายในเวลาจำกัด ผู้ใช้จะได้เห็น error ชัดเจนเร็วขึ้น
// แทนที่จะรอเงียบๆ — ไม่เกี่ยวกับการ bypass bot-detection แต่อย่างใด
const FAIL_FAST_ARGS = ['--socket-timeout', '15', '--retries', '3', '--fragment-retries', '3'];

// จำลอง TLS/HTTP fingerprint ของเบราว์เซอร์จริง (ผ่าน curl_cffi ที่ติดตั้งไว้
// ใน Dockerfile) เพื่อลดโอกาสโดน bot-detection บล็อกด้วย 403 จากเว็บที่เช็ค
// fingerprint ระดับ TLS handshake ไม่ใช่แค่ header ธรรมดา — ถ้ารันนอก Docker
// (ตาม README) ต้อง `pip install curl_cffi` เองด้วย ไม่งั้น yt-dlp จะ error
const IMPERSONATE_ARGS = ['--impersonate', 'chrome'];

// YouTube เริ่มบังคับ "PO Token" (ต้องรันตัวสร้าง token แยกต่างหาก) กับ client
// เริ่มต้นบาง client (เช่น android_vr, ios) ก่อนจะยอมให้ดาวน์โหลด ไม่งั้นได้
// 403 — แต่ client "web_safari" (ใช้ HLS) และ "mweb" ยังไม่ต้องใช้ PO Token
// (อ้างอิง yt-dlp wiki: PO-Token-Guide) จึงล็อกให้ yt-dlp ลองสอง client นี้
// ก่อนแทนที่จะปล่อยให้เลือก client อัตโนมัติแล้วไปเจอ 403 กลางทาง — แลกมาด้วย
// เพดานความชัดที่ต่ำกว่าปกติ (ไม่มี PO Token = ไม่มี format ความชัดสูงสุด)
const EXTRACTOR_ARGS = ['--extractor-args', 'youtube:player_client=web_safari,mweb'];

// เรียก yt-dlp binary ผ่าน child_process แทนการเรียก HTTP API ของแพลตฟอร์ม
// เอง — yt-dlp จัดการ extractor เฉพาะเว็บ/merge stream/แปลงไฟล์ให้ทั้งหมด
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [...args, ...FAIL_FAST_ARGS, ...IMPERSONATE_ARGS, ...EXTRACTOR_ARGS]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => reject(err)); // เช่น หา binary ไม่เจอ
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp จบด้วย exit code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

// จำกัดความชัดด้วย height<=N แล้ว fallback ไป 'best' รวม (ไม่ระบุ height) ถ้า
// หา stream ที่ตรง height นั้นไม่เจอ — ใช้ VIDEO_QUALITIES ที่ route validate
// ไว้แล้วเท่านั้น เพื่อไม่ให้ค่าที่ไม่รู้จักหลุดเข้ามาต่อ string เอง
const VIDEO_QUALITIES = {
  best: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4',
  1080: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]',
  720: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]',
  480: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]',
};

// format: 'video' → mp4 (video+audio merge, เลือกความชัดได้ผ่าน quality),
// 'audio' → mp3 (แยกเสียงอย่างเดียว ไม่มีแนวคิดความชัด)
async function downloadMedia(sourceUrl, format, quality = 'best') {
  const id = randomUUID();
  // %(ext)s ให้ yt-dlp ใส่นามสกุลไฟล์จริงให้เอง (ขึ้นกับ format ที่เลือก)
  const outputTemplate = path.join(DOWNLOAD_DIR, `${id}.%(ext)s`);

  if (format === 'audio') {
    await runYtDlp([
      '-x', // extract audio เท่านั้น
      '--audio-format', 'mp3',
      '-o', outputTemplate,
      sourceUrl,
    ]);
    return { id, fileName: `${id}.mp3` };
  }

  await runYtDlp([
    '-f', VIDEO_QUALITIES[quality] || VIDEO_QUALITIES.best,
    '--merge-output-format', 'mp4', // ffmpeg (ติดตั้งไว้ใน Dockerfile) ใช้ merge ตรงนี้
    '-o', outputTemplate,
    sourceUrl,
  ]);
  return { id, fileName: `${id}.mp4` };
}

module.exports = { downloadMedia, DOWNLOAD_DIR, VIDEO_QUALITIES };
