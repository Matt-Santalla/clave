# Clave — Unofficial Windows Builds

> This is an **unofficial fork** of [`codika-io/clave`](https://github.com/codika-io/clave), maintained by [@Matt-Santalla](https://github.com/Matt-Santalla) for the sole purpose of producing **Windows installer builds**.
>
> The upstream project ships macOS-only releases. **No application code is changed in this fork** — the only addition is a GitHub Actions workflow (`.github/workflows/build-win.yml`) that compiles the existing cross-platform Electron app into a Windows `.exe` installer.
>
> All credit for Clave goes to [Codika](https://github.com/codika-io). For features, design, and product direction, please go to the [upstream repository](https://github.com/codika-io/clave).

---

## What is Clave?

Clave is a desktop app for managing multiple [Claude Code](https://www.anthropic.com/claude-code) sessions in one window — multi-pane layouts, color-coded session groups, queued prompts, integrated git/file/SSH browsing, token usage tracking. See the [upstream README](https://github.com/codika-io/clave#readme) for the complete feature list, screenshots, and demo.

## Download (Windows)

> **Latest installer:** [Releases →](https://github.com/Matt-Santalla/clave/releases/latest)

1. Download `clave-<version>-setup.exe` from the latest release.
2. Run the installer.
3. On first launch, sign in to Claude Code (see prerequisites below).

### Prerequisites

Clave manages Claude Code — it does **not** bundle Claude Code itself. Install the CLI first:

```bash
npm install -g @anthropic-ai/claude-code
claude
```

(Node.js 20+ required for the CLI install.)

### First-run heads-up: SmartScreen

The installer is **unsigned** (no Windows code-signing certificate — those run ~$200/yr and aren't budgeted for an unofficial fork). When you run it, Windows will show *"Windows protected your PC"*.

Click **More info → Run anyway**. This is standard for indie Electron apps and does not indicate a problem.

If you have a corporate-policy reason to require a signed installer, file an issue and we can discuss options.

### No auto-update on Windows

Upstream's auto-updater is wired to Codika's macOS-only release feed. Windows users should check this fork's [Releases page](https://github.com/Matt-Santalla/clave/releases) periodically. A scheduled rebuild keeps releases here in sync with upstream — see [Sync cadence](#sync-cadence) below.

## For macOS or Linux users

This fork exists only because there is no upstream Windows release. If you're on Mac or Linux, please use upstream:

- **macOS:** [codika-io/clave/releases](https://github.com/codika-io/clave/releases) — official `.dmg` with auto-updates
- **Linux:** clone upstream and run `npm run build:linux`

## How Windows builds are produced

A GitHub Actions workflow (`.github/workflows/build-win.yml`) runs on a `windows-latest` runner:

1. Checks out this fork (which tracks upstream `main`)
2. Installs Node 20 and project dependencies
3. Runs `electron-builder --win` to package an NSIS installer
4. Uploads the `.exe` as a build artifact

The same `.exe` is then attached to a tagged release on this fork for direct public download.

You can trigger a build manually from the [Actions tab](https://github.com/Matt-Santalla/clave/actions/workflows/build-win.yml) → **Run workflow**, or the scheduled job will handle it (see below).

## Sync cadence

This fork aims to track upstream releases on a **monthly** rebuild cadence. The version available here will usually be the most recent upstream version at the time of the last build.

If you need a fresh build against a newer upstream version sooner, [open an issue](https://github.com/Matt-Santalla/clave/issues/new) and a manual build will be triggered.

## Reporting bugs

Please direct bug reports to the right place:

| Issue type | Where to report |
|---|---|
| The app misbehaves (UI bug, feature request, crash inside Clave) | [codika-io/clave/issues](https://github.com/codika-io/clave/issues) — this fork does not modify app code |
| Windows installer fails, build error, SmartScreen workaround question | [Matt-Santalla/clave/issues](https://github.com/Matt-Santalla/clave/issues) |
| Request a fresh build against latest upstream | [Matt-Santalla/clave/issues](https://github.com/Matt-Santalla/clave/issues) |

## Maintenance status

This is a **best-effort, single-maintainer** fork. If upstream begins shipping official Windows builds, this fork will be archived in favor of upstream.

There is no commercial support or SLA. Use at your own discretion.

## License

[MIT](LICENSE) — identical to upstream.

---

*Generated workflow + fork tooling assisted by Claude Code. App code is entirely Codika's work.*
