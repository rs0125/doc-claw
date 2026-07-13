import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Canonical sign-in lives at "/"; keep /login working for any inbound links and
// the app's redirect("/login") auth guards.
export default function LoginPage() {
  redirect("/");
}
