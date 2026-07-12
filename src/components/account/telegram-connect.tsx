"use client";

import { useState } from "react";
import { MessageCircle, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/** "Connect Telegram" button + modal showing a fresh link code and instructions. */
export function TelegramConnect() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<{ code: string; botUsername: string; expiresInHours: number }>();
  const [copied, setCopied] = useState(false);

  async function openModal() {
    setOpen(true);
    setError(undefined);
    setData(undefined);
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/connect-code", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not create a code");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const command = data ? `/link ${data.code}` : "";

  return (
    <>
      <Button onClick={openModal}>
        <MessageCircle /> Connect Telegram
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Connect Telegram">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Generating a link code…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {data && (
          <div className="flex flex-col gap-3 text-sm">
            <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
              <li>
                Open the bot:{" "}
                <a
                  className="font-medium text-foreground underline"
                  href={`https://t.me/${data.botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{data.botUsername}
                </a>
              </li>
              <li>Send it this message:</li>
            </ol>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(command);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm"
            >
              <span>{command}</span>
              {copied ? <Check className="size-4 text-foreground" /> : <Copy className="size-4 text-muted-foreground" />}
            </button>
            <p className="text-xs text-muted-foreground">
              This code works once and expires in {data.expiresInHours} hours. Refresh this page
              after connecting.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
