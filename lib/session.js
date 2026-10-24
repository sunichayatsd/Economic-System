import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

// Second line of defence behind the middleware: every page re-checks the session on the server.
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/admin");
  if (!session.user?.isAdmin) redirect("/");
  return session.user;
}
