# Project Summary

Last updated: 2026-05-17

## ภาพรวมโปรเจกต์

โปรเจกต์นี้เป็น Next.js 15 App Router application สำหรับ flow ซื้อประกันรถยนต์แบบ LINE Mini App style โดยแบ่งเป็น 3 ฝั่งหลัก:

- ลูกค้า: ค้นหา เปรียบเทียบ เลือกแพ็กเกจ กรอกข้อมูล ชำระเงิน และติดตามคำสั่งซื้อ
- แอดมิน/โบรกเกอร์: จัดการ campaign/package/import CSV/payment setup และ monitor orders
- บริษัทประกัน: ใช้ Magic Link เพื่อตรวจข้อมูลลูกค้า ดูสลิป และอัปเดตสถานะกรมธรรม์

## สิ่งที่ทำแล้ว

### Customer Flow

- Customer flow เริ่มที่ `/line-app/search`
- ค้นหาแพ็กเกจจากข้อมูลจริงในฐานข้อมูลตามยี่ห้อ รุ่น ปี และความคุ้มครอง
- ค้นหาตามประเภทรถ `SClass` และทุนประกันจากช่วง `MinSI`/`MaxSI`
- ค้นหาตามขนาดเครื่องยนต์/ขนาดรถจากช่วง `MinCST`/`MaxCST` ได้ แม้ไม่มี master รุ่นย่อยแยกใน CSV
- ปีจดทะเบียนถูกแปลงเป็นอายุรถเพื่อเทียบกับช่วง `MinYear`/`MaxYear` ใน CSV
- หน้า results แสดงแพ็กเกจพร้อม pagination
- Result cards encode uploaded logo URLs and fall back to company text if a logo image cannot load.
- Missing repair type is shown as `อู่ประกัน` for now; `อู่ห้าง` separation is deferred until the source data rule is confirmed.
- เลือกแพ็กเกจเพื่อเปรียบเทียบ และดูตารางเปรียบเทียบได้
- เอาประกันชั้น 1 ออกจาก customer-facing flow แล้ว
- หน้า Policy Info เก็บข้อมูลลูกค้า รถ ทะเบียน ที่อยู่ และข้อมูลกรมธรรม์
- Checkout รองรับ:
  - โอนเงินเข้าบัญชีบริษัทประกันโดยตรง พร้อมอัปโหลดสลิป
  - ชำระผ่าน gateway/payment URL ของบริษัทประกัน
- หน้า success แสดงสรุปคำสั่งซื้อ วิธีชำระเงิน และ timeline ล่าสุด
- หน้า tracking ค้นหาและติดตามสถานะ order ด้วยเลข order ได้

### Admin / Broker Flow

- มี `/admin/login` ด้วย `ADMIN_PASSWORD`
- `/admin` เป็น order monitor dashboard
- filter order ได้ตามเลข order, ลูกค้า, เบอร์, ทะเบียน, status, provider, payment method, date range และ missing provider email
- ตาราง order มี pagination
- เพิ่ม export CSV ตาม filter ปัจจุบันที่ `/admin/orders/export`
- ดูรายละเอียด order ได้ที่ `/admin/orders/[orderId]`
- หน้า order detail แสดง customer, vehicle, package, payment, slip/gateway, provider, email outbox และ internal timeline
- `/admin/insurance` รองรับ campaign dashboard, CSV import, logo upload, provider contact และ payment setup
- `/admin/insurance/packages` รองรับ search/edit package
- Campaign-level logo, payment QR/image, bank details, provider payment URL และ payment notes ทำแล้ว
- Replace/delete logo และ payment QR มี cleanup ไฟล์เก่าใน local storage แล้ว

### Insurance Provider Magic Link

- มี provider Magic Link route ที่ `/insurance/update/[token]`
- Raw token ไม่ถูกเก็บในฐานข้อมูล เก็บเฉพาะ SHA-256 hash ใน `MagicLinkToken`
- Provider page แสดงข้อมูลที่บริษัทประกันต้องใช้ตัดสินใจ:
  - customer contact และ address
  - ID card number เมื่อมี
  - vehicle และ plate
  - selected package, repair type, coverage และ amount
  - payment method/status
  - payment slip หรือ gateway link
- Provider อัปเดตสถานะได้:
  - `INSURER_REVIEWING`
  - `POLICY_APPROVED`
  - `POLICY_ISSUED`
  - `REJECTED`
- ทุก provider update เขียน `OrderStatusHistory`

### Email / Notification

- มี `EmailOutbox` สำหรับ audit/outbox
- Checkout สร้าง Magic Link และ Email Outbox row ให้ provider
- Admin ส่งหรือ retry outbox row ได้
- Missing provider email ถูกบันทึกเป็น `MISSING_RECIPIENT`
- Email Outbox reuse/refresh latest row ต่อ order เพื่อลด duplicate visible queue rows
- Admin dashboard แสดง latest provider email status ต่อ order
- Status/payment/email labels แสดงภาษาไทย โดยคง internal enum/status values เดิม
- Current sender ยังเป็น mock sender (`sendProviderEmailMock`)

### Infrastructure / Documentation

- Prisma schema มี models หลัก:
  - `User`
  - `InsurancePackage`
  - `Order`
  - `OrderStatusHistory`
  - `MagicLinkToken`
  - `EmailOutbox`
- มีเอกสาร handoff:
  - `AGENTS.md`
  - `PROJECT_STATE.md`
  - `PROJECT_HANDOVER.md`
  - `IMPLEMENTATION_BLUEPRINT.md`
- `.gitignore` กัน local uploads/generated artifacts สำคัญแล้ว
- Build ล่าสุดผ่าน โดยยังมี known warning เรื่อง `<img>` usage

## สิ่งที่ยังไม่ได้ทำ

### Real Email Integration

- ยังไม่ได้ต่อ SMTP, Resend, SendGrid หรือ Amazon SES
- `sendProviderEmailMock` ยังเป็น mock sender
- Production email delivery ยังต้องทำโดยรักษา Email Outbox audit updates เดิมไว้

### Real LINE Integration

- ยังไม่ได้ต่อ LINE Messaging API
- ยังไม่มี real LINE push notification
- LINE rich menu และ LIFF consent ยังอยู่นอก scope ของ web app ตอนนี้

### Magic Link Improvements

- ยังไม่ได้ทำ token invalidation/rotation หลัง provider action
- ยังไม่ได้เพิ่ม provider identity fields ที่แข็งแรงขึ้น
- Expired/invalid Magic Link error page ยังควรปรับ UX
- Provider-facing attachment/download views ยังเป็น future improvement

### Admin / Reports

- มี CSV export แล้ว แต่ยังไม่มี report view แบบละเอียด
- ยังไม่มี scheduled exports
- ควรพิจารณาแยก navigation ระหว่าง campaign/package management กับ order monitoring ให้ชัดขึ้น

### Data / Import

- ควร document supported CSV columns ให้ละเอียดขึ้น
- ยังไม่ได้รองรับ provider contact/payment fields จาก CSV โดยตรง ถ้า source data มี field เหล่านี้

### Production Readiness

- Uploaded slips, logos และ payment QR/images ยังเก็บใน local filesystem ที่ `public/uploads`
- ต้องตัดสินใจ production storage เช่น S3, R2 หรือ blob storage
- Local DB เคย sync ด้วย `npx prisma db push`; environment อื่นต้อง push schema หรือทำ migration จริง
- ยังไม่มี central payment gateway/webhook เพราะ product decision ปัจจุบันคือให้ลูกค้าจ่ายตรงกับบริษัทประกัน

## สถานะล่าสุด

MVP flow หลักใช้งานได้ครบในระดับ local:

- ลูกค้าค้นหา เปรียบเทียบ เลือกแพ็กเกจ กรอกข้อมูล และเลือกวิธีชำระเงินได้
- แอดมิน monitor orders, ดูรายละเอียด, จัดการ campaign/package และ export CSV ได้
- บริษัทประกันใช้ Magic Link ตรวจข้อมูล ดูสลิป และอัปเดตสถานะกรมธรรม์ได้

งานใหญ่ที่เหลือคือ real integrations และ production hardening:

- Real email provider
- LINE Messaging API
- Production file storage
- Report/export workflow ที่จริงจังขึ้น
