const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const DOWNLOAD_DIR = path.join(__dirname, '..', '..', 'downloads');
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// หมายเหตุการใช้งาน: ใช้ดาวน์โหลดเฉพาะวิดีโอที่มีสิทธิ์ใช้งาน/เผยแพร่ซ้ำได้
// (เช่นคลิปของตัวเอง, Creative Commons, หรือเนื้อหาที่แพลตฟอร์มต้นทางอนุญาต)
// เคารพ Terms of Service ของเว็บไซต์ต้นทางเสมอ

// เรียก yt-dlp binary ผ่าน child_process แทนการเรียก HTTP API ของแพลตฟอร์ม
// เอง — yt-dlp จัดการ extractor เฉพาะเว็บ/merge stream/แปลงไฟล์ให้ทั้งหมด
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args);
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

// format: 'video' → mp4 (video+audio merge), 'audio' → mp3 (แยกเสียงอย่างเดียว)
async function downloadMedia(sourceUrl, format) {
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
    // ขอ mp4 ที่ดีที่สุดเท่าที่หาได้ ถ้าไม่มีไฟล์ mp4 รวมมาเลยให้ merge เอง
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4',
    '--merge-output-format', 'mp4', // ffmpeg (ติดตั้งไว้ใน Dockerfile) ใช้ merge ตรงนี้
    '-o', outputTemplate,
    sourceUrl,
  ]);
  return { id, fileName: `${id}.mp4` };
}

module.exports = { downloadMedia, DOWNLOAD_DIR };
