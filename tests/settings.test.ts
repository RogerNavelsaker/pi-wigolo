import { describe, expect, it } from "bun:test";
import { defaults, mergeSettings, parseSettings } from "../index";

describe("Wigolo settings", () => {
  it("validates and parses persisted settings", () => {
    expect(parseSettings('{"command":"bunx","args":["wigolo"]}')).toEqual({ command: "bunx", args: ["wigolo"] });
    expect(() => parseSettings('{"args":"wigolo"}')).toThrow();
  });

  it("uses bunx defaults when command is overridden", () => {
    expect(mergeSettings(defaults(), { PI_WIGOLO_COMMAND: "bunx" } as NodeJS.ProcessEnv).args).toEqual(["wigolo"]);
  });

  it("lets explicit environment args and env override settings", () => {
    const value = mergeSettings({ ...defaults(), command: "bunx", args: ["wigolo"], env: { A: "old" } }, {
      PI_WIGOLO_ARGS: '["--yes","wigolo"]',
      PI_WIGOLO_ENV: '{"A":"new","B":"2"}',
    } as NodeJS.ProcessEnv);
    expect(value.args).toEqual(["--yes", "wigolo"]);
    expect(value.env).toEqual({ A: "new", B: "2" });
  });
});
