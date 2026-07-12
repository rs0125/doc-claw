import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TelegramConnect } from "@/components/account/telegram-connect";
import { TelegramRevoke } from "@/components/account/telegram-revoke";
import { getSessionDoctor } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");

  const link = await prisma.telegramLink.findUnique({ where: { doctorId: doctor.id } });
  const connected = !!link?.chatId;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Patients
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{doctor.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{doctor.email}</span>
          </div>
          {doctor.clinicName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Clinic</span>
              <span className="font-medium">{doctor.clinicName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Telegram</CardTitle>
            {connected ? (
              <Badge>
                <CheckCircle2 className="mr-1 size-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Circle className="mr-1 size-3" /> Not connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {connected ? (
            <>
              <div className="flex flex-col gap-1 text-muted-foreground">
                <p>
                  A Telegram chat is connected and can manage your patients through the bot.
                </p>
                {link?.linkedAt && (
                  <p className="text-xs">
                    Connected on {link.linkedAt.toISOString().slice(0, 10)}.
                  </p>
                )}
              </div>
              <TelegramRevoke />
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Connect a Telegram chat to manage patients by messaging the bot. You&apos;ll get a
                one-time code to send it.
              </p>
              <TelegramConnect />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
