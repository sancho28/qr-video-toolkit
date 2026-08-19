# =============================================================================
# Dockerfile: backend (Node.js + Express + yt-dlp + ffmpeg)
# ไม่มีขั้นตอน compile/build (เป็น plain JavaScript) จึงใช้ single-stage —
# แต่ยังต้องติดตั้งเครื่องมือระบบเพิ่มเติม (ffmpeg, yt-dlp) ที่ npm ให้ไม่ได้
# =============================================================================

FROM node:20-alpine

# ffmpeg: yt-dlp ใช้ merge video+audio stream ที่แยกกันมา หรือแปลง audio
#         เป็น mp3 ตอนเลือกโหมด "เสียงเท่านั้น"
# curl:   ใช้ดาวน์โหลดตัว yt-dlp binary ในบรรทัดถัดไป (ใช้ครั้งเดียวตอน build)
RUN apk add --no-cache ffmpeg curl python3

# ดึง yt-dlp เวอร์ชันล่าสุดมาวางไว้ใน PATH ตรงๆ — ไฟล์นี้เป็น Python zipapp
# จึงต้องมี python3 ในระบบด้วย (ตัว yt-dlp_linux standalone build มาสำหรับ
# glibc ใช้บน alpine/musl ไม่ได้)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app

# copy package.json/lockfile ก่อนโค้ดจริง เพื่อใช้ Docker layer cache — แก้
# โค้ดใน src/ แล้ว build ใหม่จะไม่ต้อง npm ci ซ้ำถ้า dependency ไม่เปลี่ยน
COPY package*.json ./
RUN npm ci --omit=dev

# copy source code ทีหลังสุด (เปลี่ยนบ่อยที่สุด)
COPY src ./src

# โฟลเดอร์เก็บไฟล์ผลลัพธ์ — ใน docker-compose จะ mount volume ทับ path นี้
# เพื่อให้ไฟล์อยู่รอดข้าม container restart
RUN mkdir -p downloads src/qrcodes

EXPOSE 3000

# yt-dlp ใช้ self-update (-U) ทุกครั้งที่ container เริ่ม/restart แทนที่จะ
# ค้างอยู่กับเวอร์ชันตอน build image — เว็บต้นทาง (YouTube ฯลฯ) เปลี่ยน
# extractor บ่อย เวอร์ชันเก่าจึงพังง่าย ถ้า self-update ล้มเหลว (เช่น
# ไม่มีเน็ตตอน build/start) ใช้ "|| true" ให้ backend เริ่มรันต่อได้ปกติ
CMD ["sh", "-c", "yt-dlp -U || true; exec node src/server.js"]
