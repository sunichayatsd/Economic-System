# Admin Login setup

ระบบรองรับ Google Login สำหรับโดเมน `thestandard.co` และแยกสิทธิ์ Admin ด้วยรายชื่ออีเมล

## Environment Variables

- `GOOGLE_CLIENT_ID` — OAuth Client ID จาก Google Cloud
- `GOOGLE_CLIENT_SECRET` — OAuth Client Secret จาก Google Cloud
- `NEXTAUTH_URL` — `https://event-ad-dashboard.vercel.app`
- `NEXTAUTH_SECRET` — ค่าสุ่มยาวสำหรับเซ็น Session
- `ADMIN_EMAILS` — อีเมล Admin คั่นด้วย comma เช่น `name@thestandard.co,other@thestandard.co`
- `AUTH_ENFORCED` — เริ่มด้วย `false`; เปลี่ยนเป็น `true` หลังทดสอบ Login สำเร็จ

## Google OAuth URLs

- Authorized JavaScript origin: `https://event-ad-dashboard.vercel.app`
- Authorized redirect URI: `https://event-ad-dashboard.vercel.app/api/auth/callback/google`

## Safe rollout

1. ตั้งค่า Variables ด้านบน โดยให้ `AUTH_ENFORCED=false`
2. Redeploy แล้วทดสอบ `/login` ด้วยบัญชี Admin
3. เปิด `/admin` และตรวจว่าสถานะ Google Login กับ Session Secret เป็น “พร้อม”
4. เปลี่ยน `AUTH_ENFORCED=true` แล้ว Redeploy อีกครั้ง

เมื่อเปิด `AUTH_ENFORCED=true` ทั้งหน้า Dashboard และ API (ยกเว้น NextAuth) จะต้องมี Session ก่อนใช้งาน
