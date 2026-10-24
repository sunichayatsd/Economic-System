"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginBox() {
  const error = useSearchParams().get("error");
  const callbackUrl = useSearchParams().get("callbackUrl") || "/";
  const message = error === "AccessDenied"
    ? "อีเมลนี้เข้าไม่ได้ ต้องเป็นบัญชี @thestandard.co"
    : ["OAuthSignin", "OAuthCallback", "Configuration"].includes(error)
      ? "Google Login ยังตั้งค่าไม่ครบ กรุณาให้ Admin ตรวจ GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET"
      : "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง";
  return (
    <main className="login">
      <div className="card">
        <h1>Event Ad Dashboard</h1>
        <p className="muted">สำหรับทีม THE STANDARD — เข้าสู่ระบบด้วยอีเมล <b>@thestandard.co</b> เท่านั้น</p>
        {error && <p className="err">{message}</p>}
        <button className="primary" onClick={() => signIn("google", { callbackUrl })}>เข้าสู่ระบบด้วย Google</button>
      </div>
    </main>
  );
}

export default function Login() {
  return <Suspense><LoginBox /></Suspense>;
}
