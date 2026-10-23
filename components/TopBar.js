"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function TopBar({ title, back, wide = false }) {
  const { data } = useSession();
  return (
    <header className="top">
      <div className={`wrap row${wide ? " wide-wrap" : ""}`}>
        <div>
          {back && <Link href="/" className="back">← เลือก Event</Link>}
          <h1>{title}</h1>
        </div>
        {data?.user && (
          <div className="who">
            <span>{data.user.email}</span>
            <button className="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>ออกจากระบบ</button>
          </div>
        )}
      </div>
    </header>
  );
}
