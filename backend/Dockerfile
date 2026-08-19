# =============================================================================
# Dockerfile: backend (Node.js + Express + yt-dlp + ffmpeg)
# ไม่มีขั้นตอน compile/build (เป็น plain JavaScript) จึงใช้ single-stage —
# แต่ยังต้องติดตั้งเครื่องมือระบบเพิ่มเติม (ffmpeg, yt-dlp) ที่ npm ให้ไม่ได้
# =============================================================================

FROM node:20-alpine

# ffmpeg: รวมไฟล์วิดีโอ+เสียง หรือแปลงเป็น mp3 ให้ yt-dlp
# curl: ใช้โหลดตัว yt-dlp binary ในขั้นตอนถัดไป
# python3: yt-dlp เป็นไฟล์ python ต้องมี python3 ถึงจะรันได้
# py3-pip: ใช้ติดตั้ง curl_cffi ในขั้นตอนถัดไป
# deno: yt-dlp ใช้รัน JS ของ YouTube เพื่อถอดรหัส signature ของลิงก์ดาวน์โหลด
#       (ไม่มี deno แล้ว YouTube จะเปลี่ยนไปให้ format คุณภาพต่ำ/พังง่ายกว่าเดิม)
RUN apk add --no-cache ffmpeg curl python3 py3-pip deno

# ดึง yt-dlp เวอร์ชันล่าสุดมาวางไว้ใน PATH ตรงๆ — ไฟล์นี้เป็น Python zipapp
# จึงต้องมี python3 ในระบบด้วย (ตัว yt-dlp_linux standalone build มาสำหรับ
# glibc ใช้บน alpine/musl ไม่ได้)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# curl_cffi: ให้ yt-dlp ใช้ --impersonate (แกล้งเป็นเบราว์เซอร์จริง) กันโดน
# เว็บต้นทางบล็อกด้วย 403 (bot-detection)
# - apk ไม่มีแพ็กเกจนี้ ต้องลงผ่าน pip
# - ต้องใส่ --break-system-packages เพราะ python3 บน alpine ไม่ให้ pip install
#   ตรงๆ (PEP 668) — ไม่มีปัญหาเพราะ image นี้ไม่มี pip package อื่นให้ชน
# - ต้องล็อกเวอร์ชัน <0.16 เพราะ yt-dlp รุ่นนี้รองรับแค่ 0.10.x-0.15.x
#   (เวอร์ชันใหม่กว่านั้นจะถูก yt-dlp มองว่า "ใช้ไม่ได้" ทันที)
RUN pip install --break-system-packages --no-cache-dir "curl_cffi>=0.10,<0.16"

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
