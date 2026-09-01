# Cloudflare Tunnel สำหรับ Scopebot

ไฟล์นี้เป็นส่วนหนึ่งของคู่มือหลัก: [../DEPLOY.md](../DEPLOY.md)

## สิ่งที่ได้

```text
https://your-subdomain.example.com  (HTTPS จาก Cloudflare)
        ↓ Tunnel
frontend:80 (nginx ใน Docker)
  ├─ /        → React
  └─ /api/*   → FastAPI  (รวม LINE webhook)
```

ไม่ต้องเปิดพอร์ต 80/443 ออกอินเทอร์เน็ต และไม่ต้องใช้ ngrok
