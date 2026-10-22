# pi-wigolo

A Pi extension that registers [Wigolo](https://github.com/KnockOutEZ/wigolo) as a native MCP server using Pi's built-in MCP support.

## Install

```text
pi install git:github.com/RogerNavelsaker/pi-wigolo
```

Wigolo starts automatically when a Pi session starts. The default command is `npx -y wigolo`; Pi connects its tools with `codemode` exposure. The extension does not install Wigolo itself: the configured package runner may download it on first use.

## Configure

Run `/wigolo` for connection status and settings. Settings are saved to `~/.pi/agent/pi-wigolo/settings.json` (mode 0600). Change the executable to `bunx` to use Bun; when switching between the default `npx` and `bunx` commands, default arguments update accordingly. Arguments and environment overrides are editable from the same menu.

Environment variables override saved settings:

| Variable | Meaning |
| --- | --- |
| `PI_WIGOLO_ENABLED` | Set to `false` to disable |
| `PI_WIGOLO_COMMAND` | Executable, e.g. `npx` or `bunx` |
| `PI_WIGOLO_ARGS` | JSON array of arguments; if omitted with `bunx`, defaults to `["wigolo"]` |
| `PI_WIGOLO_ENV` | JSON object of environment values |

If `PI_WIGOLO_COMMAND` is set, `npx`-style arguments are the default except for `bunx`, which uses `wigolo`. Set `PI_WIGOLO_ARGS` to choose another invocation explicitly. Environment overrides are not displayed as values in the UI.

A matching `wigolo` entry in Pi's `mcp.json` takes precedence over extension registration. In that case Pi's `/mcp` view shows the effective server configuration.

## Development

```sh
bun run check
```
