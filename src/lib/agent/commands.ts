import type { Doctor } from "@/generated/prisma/client";
import { agentAuth } from "@/lib/auth";
import { cancelAction, listPendingActions } from "@/services/pending-actions";
import { createLoginToken } from "@/lib/web-auth";

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "https://doc-claw.vercel.app").replace(/\/$/, "");
}

export type BotCommand = { command: string; description: string };

/**
 * Command menu registered with Telegram via setMyCommands (shows in the bot's
 * "/" menu). Linking commands (/link, /unlink) are handled separately and kept
 * out of the everyday menu.
 */
export const BOT_COMMANDS: BotCommand[] = [
  { command: "find", description: "Find a patient by name or phone" },
  { command: "add", description: "Register a new patient" },
  { command: "visit", description: "Record a visit / encounter" },
  { command: "prescribe", description: "Write a prescription" },
  { command: "surgery", description: "Record a surgery" },
  { command: "web", description: "Open your dashboard in a browser" },
  { command: "cancel", description: "Cancel a pending change" },
  { command: "help", description: "What this bot can do" },
];

export const HELP_TEXT = [
  "Kordex Health — your patient-records assistant.",
  "",
  'Talk to me normally ("what is Ramesh on?", "add a new patient Sita Devi, 45, female") or use commands:',
  "/find <name> — find a patient",
  "/add <details> — register a new patient",
  "/visit <details> — record a visit / encounter",
  "/prescribe <details> — write a prescription",
  "/surgery <name> — record a surgery",
  "/web — open your dashboard in a browser",
  "/cancel — cancel a change you haven't confirmed",
  "/unlink — disconnect this chat",
  "",
  "Every change is shown back to you for confirmation before anything is saved.",
].join("\n");

export type CommandResult =
  | { kind: "reply"; text: string } // send this directly, no agent
  | { kind: "agent"; instruction: string } // run this through the agent loop
  | { kind: "passthrough" }; // not a slash command — treat as normal chat

/**
 * Routes a post-authentication slash command. Capability commands become
 * natural-language instructions fed to the agent, so confirm-before-write and
 * patient selection still apply — the slash commands are only a shortcut.
 */
export async function routeCommand(doctor: Doctor, text: string): Promise<CommandResult> {
  if (!text.startsWith("/")) return { kind: "passthrough" };

  const [rawCmd, ...rest] = text.slice(1).split(/\s+/);
  const cmd = rawCmd.toLowerCase().split("@")[0]; // strip @BotName that Telegram appends in groups
  const args = rest.join(" ").trim();

  switch (cmd) {
    case "help":
    case "start":
      return { kind: "reply", text: HELP_TEXT };

    case "web": {
      const raw = await createLoginToken(doctor.id);
      const url = `${appBaseUrl()}/auth/callback?t=${raw}`;
      return {
        kind: "reply",
        text: `Open your dashboard (link works once, expires in 10 minutes):\n${url}`,
      };
    }

    case "cancel": {
      const auth = agentAuth(doctor);
      const pending = await listPendingActions(auth);
      if (pending.length === 0) return { kind: "reply", text: "There's nothing pending to cancel." };
      for (const a of pending) await cancelAction(auth, a.id).catch(() => {});
      return {
        kind: "reply",
        text: `Cancelled ${pending.length} pending change${pending.length > 1 ? "s" : ""}. Nothing was saved.`,
      };
    }

    case "find":
      return args
        ? { kind: "agent", instruction: `Find the patient "${args}".` }
        : { kind: "reply", text: "Usage: /find <name or phone>" };

    case "add":
      return args
        ? { kind: "agent", instruction: `Register a new patient: ${args}` }
        : { kind: "reply", text: "Usage: /add <name, sex, age, phone, allergies…>" };

    case "visit":
      return args
        ? { kind: "agent", instruction: `Record a visit/encounter: ${args}` }
        : { kind: "reply", text: "Usage: /visit <patient, complaint, findings, diagnosis, plan…>" };

    case "prescribe":
      return args
        ? { kind: "agent", instruction: `Write a prescription: ${args}` }
        : {
            kind: "reply",
            text: "Usage: /prescribe <patient, drug, dose, frequency, duration…>",
          };

    case "surgery":
      return args
        ? { kind: "agent", instruction: `Record a surgery for ${args}` }
        : { kind: "reply", text: "Usage: /surgery <patient name>" };

    default:
      return { kind: "reply", text: `Unknown command /${cmd}. Send /help to see what I can do.` };
  }
}
