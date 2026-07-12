"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/** "Revoke access" button + confirm modal. On confirm, calls the revoke API. */
export function TelegramRevoke() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();

  async function revoke() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/telegram/revoke", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not revoke");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ShieldOff /> Revoke access
      </Button>
      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Revoke Telegram access?">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            The connected Telegram chat will immediately lose access to all patient records, and a
            new connection code will be issued (the old one stops working). The chat will be notified.
            You can reconnect any time from here.
          </p>
          {error && <p className="text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={revoke} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <ShieldOff />}
              Revoke access
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
