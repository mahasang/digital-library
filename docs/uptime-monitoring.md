# การเฝ้าระวังความพร้อมใช้งาน (Uptime Monitoring)

เอกสารนี้อธิบายวิธีเชื่อมต่อบริการ Uptime Monitoring ภายนอกเข้ากับ endpoint
`/api/health` ของแอปนี้ **แอปเองไม่มีระบบเก็บประวัติสถานะย้อนหลังหรือแจ้งเตือน
อัตโนมัติเมื่อระบบล่ม** (ดูเหตุผลในหัวข้อ 3) — ต้องเชื่อมต่อบริการภายนอกเพื่อ
ให้ได้ความสามารถเหล่านี้จริง

## 1. Endpoint `/api/health`

- **URL**: `https://<โดเมนจริง>/api/health` (หรือ `http://localhost:3001/api/health` ตอน dev)
- **Method**: `GET` — ไม่ต้องยืนยันตัวตน (สาธารณะโดยเจตนา สำหรับให้ uptime monitor เรียกได้)
- **HTTP Status**: `200` เมื่อระบบปกติหรือเสื่อมสภาพบางส่วน (`degraded`), `503`
  เมื่อฐานข้อมูลเชื่อมต่อไม่ได้ (`down`) — ตั้งค่า monitor ให้ถือว่า **เฉพาะ
  `200` คือ "ขึ้น" (up)** ตามมาตรฐานทั่วไป
- **Response Body** (ตัวอย่าง):

```json
{
  "status": "ok",
  "checkedAt": "2026-08-02T10:00:00.000Z",
  "checks": {
    "application": "ok",
    "database": "ok",
    "storage": "ok"
  }
}
```

| ฟิลด์ | ความหมาย |
| --- | --- |
| `status` | สรุปภาพรวม: `ok` (ทุกอย่างปกติ), `degraded` (Storage มีปัญหาแต่ฐานข้อมูลยังใช้ได้), `down` (ฐานข้อมูลเชื่อมต่อไม่ได้) |
| `checks.application` | เป็น `ok` เสมอถ้า endpoint ตอบกลับได้ (แสดงว่า Next.js server ทำงานอยู่) |
| `checks.database` | ผลตรวจสอบการเชื่อมต่อ Supabase Database (`ok`/`error`/`unknown` หากยังไม่ได้ตั้งค่า Supabase) |
| `checks.storage` | ผลตรวจสอบว่า Supabase Storage API ตอบสนองหรือไม่ |

**ไม่มีข้อมูลลับหรือรายละเอียด infrastructure ใดๆ ในคำตอบ** — ไม่มี connection
string, token, ชื่อ bucket, หรือ error message ดิบจาก Postgres/Storage เปิดเผย
ออกมา มีเฉพาะสถานะ `ok`/`error`/`unknown` เท่านั้น ตรวจสอบด้วย anon key
(สิทธิ์ต่ำสุด) ไม่ใช้ service role key

## 2. ตั้งค่าบริการ Uptime Monitoring ภายนอก

เลือกบริการใดบริการหนึ่ง (หรือมากกว่าหนึ่งเพื่อความซ้ำซ้อน) — ทั้งหมดมี free
tier เพียงพอสำหรับ endpoint เดียว:

### 2.1 UptimeRobot (ฟรี, ตั้งค่าง่ายที่สุด)

1. สมัครบัญชีที่ [uptimerobot.com](https://uptimerobot.com/)
2. สร้าง Monitor ใหม่ → **HTTP(s)**
3. URL: `https://<โดเมนจริง>/api/health`
4. Monitoring Interval: 5 นาที (free tier ต่ำสุด)
5. **Advanced settings > Accepted status codes**: ตั้งให้ยอมรับเฉพาะ `200`
   (ค่าเริ่มต้นมักยอมรับ 200-299 อยู่แล้ว ซึ่งใช้ได้เช่นกันเพราะ endpoint นี้
   ไม่คืนค่า 2xx อื่นนอกจาก 200)
6. ตั้งค่าการแจ้งเตือน (Alert Contacts) เป็นอีเมล/Slack/Line Notify ตามต้องการ

### 2.2 Better Uptime (มี status page สาธารณะในตัว)

1. สมัครบัญชีที่ [betteruptime.com](https://betteruptime.com/)
2. สร้าง Monitor ใหม่ → เลือกประเภท HTTP
3. URL: `https://<โดเมนจริง>/api/health`
4. Expected status code: `200`
5. ตั้งค่า Escalation Policy สำหรับการแจ้งเตือนตามต้องการ
6. (ทางเลือก) เปิด Public Status Page เพื่อให้ผู้ใช้ตรวจสอบสถานะระบบเองได้

### 2.3 Cloudflare Health Checks

ใช้ได้เฉพาะโดเมนที่ผ่าน Cloudflare (Proxy) อยู่แล้ว — ต้องมีแผน Cloudflare ที่
รองรับ Health Checks (มีค่าใช้จ่ายในบางแผน ตรวจสอบราคาปัจจุบันก่อนเปิดใช้งาน):

1. Cloudflare Dashboard → โดเมนของคุณ → **Traffic > Health Checks**
2. สร้าง Health Check ใหม่ ชี้ไปที่ `/api/health`
3. Expected codes: `200`
4. เชื่อมกับ Load Balancer/Notification ตามต้องการ

## 3. ทำไม `/superadmin/system-health` ไม่มีประวัติย้อนหลัง

หน้า `/superadmin/system-health` ในแอปตรวจสอบสถานะแบบ **สด (real-time) ทุกครั้ง
ที่โหลดหน้าเท่านั้น** ไม่มีการเก็บบันทึกสถานะย้อนหลังหรือระบบแจ้งเตือนอัตโนมัติ
เมื่อระบบล่ม — เป็นการตัดสินใจโดยเจตนา เพื่อไม่ให้ต้องสร้างระบบเก็บ time-series
เองซึ่งซ้ำซ้อนกับสิ่งที่บริการในหัวข้อ 2 ทำได้ดีกว่าอยู่แล้ว (มี dashboard,
กราฟย้อนหลัง, แจ้งเตือนหลายช่องทาง โดยไม่ต้องเขียนโค้ดเพิ่มในแอปนี้เลย)

**สรุป**: หากต้องการดูประวัติ uptime ย้อนหลัง กราฟ downtime หรือรับการแจ้งเตือน
อัตโนมัติเมื่อระบบมีปัญหา **ต้องเชื่อมต่อบริการในหัวข้อ 2 ข้างต้น** — แอปนี้เอง
ให้ได้แค่สถานะ ณ ขณะนั้นเท่านั้น
