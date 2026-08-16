# System Diagram — qr-video-toolkit

## Container / Network Diagram

```mermaid
flowchart LR
    subgraph Host["เครื่อง Host (localhost)"]
        Browser["🌐 Browser<br/>localhost:8080"]
    end

    subgraph Docker["Docker Compose network: toolkitnet"]
        Caddy["📦 caddy<br/>caddy:2-alpine<br/>reverse proxy<br/>(official image)"]
        Frontend["📦 frontend<br/>nginx:1.27-alpine<br/>static HTML/CSS/JS<br/>(custom Dockerfile)"]
        Backend["📦 backend<br/>node:20-alpine<br/>Express + yt-dlp + ffmpeg<br/>(custom Dockerfile)"]
        Db[("📦 db<br/>mariadb:11<br/>(official image)")]
        DVol[("💾 downloads_data")]
        QVol[("💾 qrcodes_data")]
        DBVol[("💾 db_data")]
    end

    Browser -- "HTTP :8080 → :80" --> Caddy
    Caddy -- "handle /* → frontend:80" --> Frontend
    Caddy -- "handle /api/* → backend:3000" --> Backend
    Backend -- "mysql2 pool<br/>DB_HOST=db" --> Db
    Backend -.persist.-> DVol
    Backend -.persist.-> QVol
    Db -.persist.-> DBVol

    style Caddy fill:#84cc16,color:#000
    style Frontend fill:#2563eb,color:#fff
    style Backend fill:#16a34a,color:#fff
    style Db fill:#f59e0b,color:#000
```

## Sequence Diagram — ดาวน์โหลดวิดีโอ (เลือกเอาเสียงอย่างเดียว)

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as caddy
    participant F as frontend (nginx)
    participant A as backend (Express)
    participant D as db (MariaDB)

    B->>C: GET /
    C->>F: reverse_proxy frontend:80
    F-->>C: index.html/app.js
    C-->>B: หน้าเว็บ

    B->>C: POST /api/download {url, format:"audio"}
    C->>A: reverse_proxy backend:3000
    A->>D: INSERT INTO downloads (status='pending')
    A->>A: spawn yt-dlp -x --audio-format mp3
    A->>D: UPDATE downloads SET status='done', file_name=...
    A-->>C: { file_url: "/api/download/file/xxx.mp3" }
    C-->>B: { file_url }
    B->>C: GET /api/download/file/xxx.mp3
    C->>A: reverse_proxy
    A-->>B: ไฟล์ mp3 (attachment)
```

## เหตุผลของสถาปัตยกรรม (สรุปสั้น)

- **caddy เป็นจุดเข้าเดียวของ traffic ในแอป** — publish port ออก host แค่
  container เดียว (`8080:80`) ส่วน `frontend`/`backend` ไม่เปิด port ออก
  host เลย ลด attack surface และทำให้ browser เห็นแค่ origin เดียว ไม่ต้อง
  ยุ่งกับ CORS (`db` เปิด `3306` ออก host เพิ่มเป็นข้อยกเว้นเดียว เพื่อให้ต่อ
  จาก DB client บนเครื่อง เช่น VSCode ได้ตรงๆ)
- **backend ↔ db ผ่าน internal network + user แยกจาก root** — `db` ใช้
  `MARIADB_USER`/`MARIADB_PASSWORD` แทนการต่อด้วย root ตรงๆ ตามหลัก
  least-privilege
- **`depends_on` + `healthcheck`** — `backend` รอจน MariaDB พร้อมรับ
  connection จริงก่อนค่อย start กัน race condition ตอน container ทั้งชุด
  ขึ้นพร้อมกันครั้งแรก
- **named volumes แยก 3 ก้อน** (`db_data`, `downloads_data`, `qrcodes_data`)
  — rebuild image ไม่ทำให้ข้อมูล/ไฟล์เดิมหาย
