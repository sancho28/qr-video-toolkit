# =============================================================================
# Dockerfile: frontend (static HTML/CSS/JS เสิร์ฟด้วย nginx)
# ไม่มีขั้นตอน build (ไม่ใช้ framework ที่ต้อง compile) จึง single-stage พอ —
# ต่างจาก backend ที่ต้องติดตั้งเครื่องมือระบบเพิ่ม (ffmpeg/yt-dlp)
# =============================================================================

FROM nginx:1.27-alpine

# ลบไฟล์ default/welcome page ของ nginx image ออกก่อน กัน conflict กับไฟล์เรา
RUN rm -rf /usr/share/nginx/html/*

# ก็อปไฟล์ static ทั้งหมดเข้าไปในโฟลเดอร์ที่ nginx เสิร์ฟไฟล์ตามค่า default
# ของ image (ไม่ต้องเขียน nginx.conf เองเพราะ config เริ่มต้นพอสำหรับ static
# site ธรรมดาที่ไม่มี client-side routing)
COPY public/ /usr/share/nginx/html/

EXPOSE 80
