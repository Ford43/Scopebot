# Deploy Scopebot ด้วย Cloudflare Tunnel

เป้าหมาย: ได้ **HTTPS สาธารณะ** จากเครื่องคุณ (หรือ VPS) โดยไม่เปิดพอร์ตเข้าบ้าน/เซิร์ฟเวอร์ แล้วชี้ LINE Webhook ไปที่ URL นั้น

```text
LINE / Browser
    → https://your-host.example.com   (Cloudflare)
        → Cloudflare Tunnel
            → frontend:80 (Docker)
                → /api/* → api:8000
```

## สิ่งที่ต้องมี

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) บน Windows
2. บัญชี [Cloudflare](https://dash.cloudflare.com/)
3. **โดเมนที่ชี้ nameserver มาที่ Cloudflare** (แนะนำสำหรับ LINE — URL คงที่)
4. Ollama รันบนเครื่อง + model เช่น `ollama pull qwen2.5:1.5b`

ถ้ายังไม่มีโดเมน: ใช้ Quick Tunnel ชั่วคราวได้ (หัวข้อท้าย) แต่ URL เปลี่ยนบ่อย ไม่เหมาะใช้ยาวๆ กับ LINE

---

## วิธีแนะนำ: Named Tunnel (โดเมนคงที่)

### 1) เตรียม `.env`

```powershell
copy .env.production.example .env
```

แก้ค่าอย่างน้อย:

| ตัวแปร | ค่า |
|--------|-----|
| `SECRET_KEY` | สุ่ม: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `POSTGRES_PASSWORD` | รหัสแข็งแรง |
| `ADMIN_PASSWORD` | รหัสแข็งแรง |
| `FRONTEND_URL` | `https://scopebot.yourdomain.com` (hostname ที่จะสร้าง) |
| `CORS_ORIGINS` | เหมือน `FRONTEND_URL` |
| `CLOUDFLARE_TUNNEL_TOKEN` | ได้จากขั้นถัดไป |
| `DEBUG` | `false` |

### 2) สร้าง Tunnel ใน Cloudflare

1. เข้า [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels**
2. **Create a tunnel** → เลือก **Cloudflared**
3. ตั้งชื่อ เช่น `scopebot`
4. คัดลอก **token** วางใน `.env` เป็น `CLOUDFLARE_TUNNEL_TOKEN=...`
5. เพิ่ม **Public Hostname**:
   - Subdomain: เช่น `scopebot`
   - Domain: โดเมนของคุณ
   - Type: **HTTP**
   - URL: **`frontend:80`**  
     (เพราะ cloudflared รันใน Docker network เดียวกับ frontend)

> ถ้าจะรัน `cloudflared` บน Windows host แทน Docker ให้ใส่ URL เป็น `localhost:80` หรือ `host.docker.internal:80` ไม่ใช้ชื่อ `frontend`

บันทึก hostname แล้วไปขั้นรัน stack

### 3) เปิด Ollama

```powershell
ollama serve
ollama pull qwen2.5:1.5b
```

### 4) รัน Scopebot + Tunnel

```powershell
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up --build -d
```

ตรวจ:

```powershell
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml ps
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs -f cloudflared
```

เปิดเบราว์เซอร์: `https://scopebot.yourdomain.com` → login ด้วย admin จาก `.env`

Health ภายในเครื่อง: `http://localhost:8000/api/health`

### 5) ชี้ LINE Webhook

1. ใน Scopebot (ผ่าน HTTPS) → **การเชื่อมต่อ** → คัดลอก Webhook URL  
   `https://scopebot.yourdomain.com/api/line/webhook/bot_xxxxxxxx`
2. LINE Developers → Webhook URL → **Update** → **Verify** → เปิด **Use webhook**
3. ทดสอบแชท OA
4. ปิด ngrok ได้

### 6) Smoke test (ทางเลือก)

```powershell
$env:SMOKE_BASE_URL="http://127.0.0.1:8000"
.\.venv\Scripts\python.exe scripts\smoke_test.py
```

---

## ทางเลือก: Quick Tunnel (ไม่มีโดเมน / ทดสองเร็ว)

URL จะเป็น `https://xxxx.trycloudflare.com` และ**เปลี่ยนทุกครั้งที่รันใหม่**

### แบบง่ายสุดบน Windows (ไม่ต้อง Docker) — แนะนำเริ่มตรงนี้

ใช้กับ API ที่รันอยู่แล้ว (`uvicorn` พอร์ต 8000) เหมือนตอนใช้ ngrok

```powershell
# ติดตั้งครั้งเดียว
winget install --id Cloudflare.cloudflared -e

# ให้ API รันอยู่ก่อนที่ http://127.0.0.1:8000/api/health

# เปิด tunnel (หน้าต่างนี้เปิดค้าง)
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8000
# หรือถ้า PATH รู้จักแล้ว:  cloudflared tunnel --url http://127.0.0.1:8000
```

จาก output คัดลอก `https://xxxx.trycloudflare.com` แล้วใส่ LINE Webhook:

```text
https://xxxx.trycloudflare.com/api/line/webhook/bot_xxxxxxxx
```

หน้า Admin ยังเปิดที่ `http://localhost:5173` ได้ตามปกติ — tunnel นี้สำหรับ LINE เป็นหลัก

### แบบ Docker Quick Tunnel

```powershell
docker compose -f docker-compose.yml -f docker-compose.tunnel.quick.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.tunnel.quick.yml logs -f cloudflared
```

เมื่อเห็น `https://xxxx.trycloudflare.com`:

1. ใส่ใน `.env`:
   - `FRONTEND_URL=https://xxxx.trycloudflare.com`
   - `CORS_ORIGINS=https://xxxx.trycloudflare.com`
2. รีสตาร์ท API:

```powershell
docker compose -f docker-compose.yml -f docker-compose.tunnel.quick.yml up -d api
```

3. เอา URL นั้นไปใส่ LINE Webhook (ต้องอัปเดตใหม่ทุกครั้งที่ tunnel รีสตาร์ท)

---

## คำสั่งที่ใช้บ่อย

```powershell
# ดูสถานะ
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml ps

# log
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs -f api
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs -f cloudflared

# หยุด
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml down
```

---

## แก้ปัญหาบ่อย

| อาการ | ตรวจ |
|--------|------|
| เว็บไม่ขึ้น / 502 | `cloudflared` log; Public Hostname URL ต้องเป็น `frontend:80` เมื่อรันใน compose |
| Login CORS error | `CORS_ORIGINS` ต้องตรง URL ที่เปิดในเบราว์เซอร์เป๊ะ (รวม `https://`) |
| LINE Verify ไม่ผ่าน | ต้องเป็น HTTPS จาก tunnel; path `/api/line/webhook/...` ครบ; stack รันอยู่ |
| RAG ไม่ตอบ | Ollama บน host รันอยู่? `OLLAMA_HOST=http://host.docker.internal:11434` |
| Token error | คัดลอก `CLOUDFLARE_TUNNEL_TOKEN` ใหม่จาก Zero Trust |

---

## หลังขึ้นแล้ว

- อย่า commit ไฟล์ `.env` (มีใน `.gitignore` แล้ว)
- เปลี่ยนรหัส admin ถ้ายังเป็นค่าทดสอบ
- อัปโหลดเอกสารจริง + สร้างบัญชี support
- ปิด ngrok
