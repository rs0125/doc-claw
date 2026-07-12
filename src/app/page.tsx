import { redirect } from "next/navigation";
import { getSessionDoctor } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const doctor = await getSessionDoctor();
  redirect(doctor ? "/dashboard" : "/login/error");
}
