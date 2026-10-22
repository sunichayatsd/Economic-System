"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginBox() {
  const error = useSearchParams().get("error");
  return (
    <main className="login">
      <div className="card">
        <h1>Event Ad Dashboard</h1>
        <p className="muted">สำหรับทีม THE STANDARD — เข้าสู่ระบบด้วยอีเมล <b>@thestandard.co</b> เท่านั้น</p>
        {error && <p className="err">{error === "AccessDenied" ? "อีเมลนี้เข้าไม่ได้ ต้องเป็นบัญชี @thestandard.co" : "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง"}</p>}
        <button className="primary" onClick={() => signIn("google", { callbackUrl: "/" })}>เข้าสู่ระบบด้วย Google</button>
      </div>
    </main>
  );
}

export default function Login() {
  return <Suspense><LoginBox /></Suspense>;
}
