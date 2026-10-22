import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SERVER = "wigolo";
const SETTINGS_FILE = join(homedir(), ".pi", "agent", "pi-wigolo", "settings.json");

export type WigoloSettings = { enabled: boolean; command: string; args: string[]; env: Record<string, string> };
export const defaults = (): WigoloSettings => ({ enabled: true, command: "npx", args: ["-y", "wigolo"], env: {} });

export function parseSettings(raw: string | undefined): Partial<WigoloSettings> {
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Settings must be a JSON object.");
  const input = value as Record<string, unknown>;
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") throw new Error("enabled must be true or false.");
  if (input.command !== undefined && (typeof input.command !== "string" || !input.command.trim())) throw new Error("command must be a non-empty string.");
  if (input.args !== undefined && (!Array.isArray(input.args) || input.args.some((arg) => typeof arg !== "string"))) throw new Error("args must be an array of strings.");
  if (input.env !== undefined && (!input.env || typeof input.env !== "object" || Array.isArray(input.env) || Object.values(input.env).some((v) => typeof v !== "string"))) throw new Error("env must be an object of string values.");
  return input as Partial<WigoloSettings>;
}

export function mergeSettings(base: WigoloSettings, env: NodeJS.ProcessEnv): WigoloSettings {
  const result = { ...base, env: { ...base.env } };
  if (env.PI_WIGOLO_ENABLED !== undefined) result.enabled = env.PI_WIGOLO_ENABLED !== "false";
  if (env.PI_WIGOLO_COMMAND) {
    result.command = env.PI_WIGOLO_COMMAND;
    if (env.PI_WIGOLO_ARGS === undefined) result.args = basename(env.PI_WIGOLO_COMMAND) === "bunx" ? ["wigolo"] : ["-y", "wigolo"];
  }
  if (env.PI_WIGOLO_ARGS !== undefined) {
    const args: unknown = JSON.parse(env.PI_WIGOLO_ARGS);
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) throw new Error("PI_WIGOLO_ARGS must be a JSON array of strings.");
    result.args = args;
  }
  if (env.PI_WIGOLO_ENV !== undefined) {
    const extra = parseSettings(JSON.stringify({ env: JSON.parse(env.PI_WIGOLO_ENV) })).env!;
    result.env = { ...result.env, ...extra };
  }
  return result;
}

async function loadSettings(): Promise<WigoloSettings> {
  let saved: Partial<WigoloSettings> = {};
  try { saved = parseSettings(await readFile(SETTINGS_FILE, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const base = { ...defaults(), ...saved, env: { ...defaults().env, ...saved.env } };
  return mergeSettings(base, process.env);
}

async function saveSettings(settings: WigoloSettings): Promise<void> {
  await mkdir(join(homedir(), ".pi", "agent", "pi-wigolo"), { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });
}

export default function (pi: ExtensionAPI) {
  let settings = defaults();
  const register = () => {
    if (settings.enabled) pi.registerMcpServer(SERVER, {
      command: settings.command,
      args: settings.args,
      env: settings.env,
      exposure: "codemode",
      description: "Wigolo local web search, fetch, crawl, extraction, and research tools",
    });
    else pi.unregisterMcpServer(SERVER);
  };

  pi.on("session_start", async () => {
    settings = await loadSettings();
    register();
  });

  pi.registerCommand("wigolo", {
    description: "Wigolo MCP status and settings",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Wigolo MCP integration is managed through /wigolo in an interactive session.");
        return;
      }
      try { settings = await loadSettings(); }
      catch (error) { ctx.ui.notify(`Invalid Wigolo settings: ${String(error)}`, "error"); return; }

      const envLocked = ["PI_WIGOLO_ENABLED", "PI_WIGOLO_COMMAND", "PI_WIGOLO_ARGS", "PI_WIGOLO_ENV"].some((key) => process.env[key] !== undefined);
      while (true) {
        const server: any = (pi.getMcpServers() as any[]).find((entry) => entry.name === SERVER);
        const status = server ? "registered (see /mcp for connection state)" : (settings.enabled ? "not registered" : "disabled");
        const action = await ctx.ui.select(`Wigolo — ${status}`, [
          `Enabled: ${settings.enabled}`,
          `Command: ${settings.command}`,
          `Arguments: ${JSON.stringify(settings.args)}`,
          `Environment: ${Object.keys(settings.env).length} variable(s)`,
          "Close",
        ]);
        if (!action || action === "Close") return;
        if (envLocked) {
          ctx.ui.notify("PI_WIGOLO_* environment overrides are active; change them in the environment to edit these settings.", "warning");
          continue;
        }
        if (action.startsWith("Enabled:")) settings.enabled = !settings.enabled;
        else if (action.startsWith("Command:")) {
          const value = await ctx.ui.input("Wigolo executable (for example npx or bunx)", settings.command);
          if (value?.trim()) {
            const oldDefaultArgs = basename(settings.command) === "bunx" ? ["wigolo"] : ["-y", "wigolo"];
            const wasDefault = JSON.stringify(settings.args) === JSON.stringify(oldDefaultArgs);
            settings.command = value.trim();
            if (wasDefault) settings.args = basename(settings.command) === "bunx" ? ["wigolo"] : ["-y", "wigolo"];
          }
        } else if (action.startsWith("Arguments:")) {
          const value = await ctx.ui.input("Arguments as a JSON string array", JSON.stringify(settings.args));
          if (value !== undefined) {
            try {
              const parsed: unknown = JSON.parse(value);
              if (!Array.isArray(parsed) || parsed.some((arg) => typeof arg !== "string")) throw new Error();
              settings.args = parsed;
            } catch { ctx.ui.notify("Arguments must be a JSON array of strings.", "warning"); continue; }
          }
        } else if (action.startsWith("Environment:")) {
          const value = await ctx.ui.input("Environment overrides as a JSON object", JSON.stringify(settings.env));
          if (value !== undefined) {
            try {
              const parsed = parseSettings(JSON.stringify({ env: JSON.parse(value) })).env;
              if (parsed) settings.env = parsed;
            } catch { ctx.ui.notify("Environment must be a JSON object of string values.", "warning"); continue; }
          }
        }
        await saveSettings(settings);
        try { register(); } catch (error) { ctx.ui.notify(`Could not update Wigolo MCP: ${String(error)}`, "error"); }
      }
    },
  });
}
