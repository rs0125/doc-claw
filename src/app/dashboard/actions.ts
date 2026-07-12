"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revokeCurrentSession, SESSION_COOKIE } from "@/lib/web-auth";

export async function logout() {
  await revokeCurrentSession();
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
