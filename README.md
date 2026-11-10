I make small desktop apps that sit in the menu bar and stay out of the way. They're written in Rust and Tauri, free, and open source. Before that, and still on most days, I build backends and Telegram bots in TypeScript.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/stats-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/stats-light.svg" alt="Installer downloads, releases shipped, pull requests merged and stars across my apps" width="840" />
</picture>

<a href="https://github.com/Abulkosim/margin"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/margin-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/margin-light.svg" alt="Margin: Claude Code and Codex usage limits across accounts, for macOS and Windows" width="840" />
</picture></a>
<a href="https://github.com/Abulkosim/wick"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/wick-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/wick-light.svg" alt="Wick: keeps your computer awake, for macOS, Windows and Linux" width="840" />
</picture></a>
<a href="https://github.com/Abulkosim/weir"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/weir-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/weir-light.svg" alt="Weir: internet speed and connection checks, for macOS and Windows" width="840" />
</picture></a>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/cadence-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/cadence-light.svg" alt="Releases per week over the last 26 weeks, and the latest releases" width="840" />
</picture>

```sh
brew install --cask abulkosim/tap/wick
brew install --cask abulkosim/tap/weir
```

### How the apps ship

- Every release is built in CI, comes with SHA-256 sums and an SPDX SBOM, and carries build provenance you can check with `gh attestation verify`.
- Auto-updates are signed and checked by the app before it installs anything. Nothing updates without you saying so.
- Actions are pinned to commit SHAs. OpenSSF Scorecard, `cargo audit`, `cargo deny` and `pnpm audit` run on every app, CodeQL runs on Margin and Weir, and Weir's parsers are fuzzed.
- No telemetry and no accounts. What each app reads and sends is written down in its README.

### Also here

- [typeprose](https://github.com/Abulkosim/typeprose): typing practice with passages from public-domain books.
- [nudge](https://github.com/Abulkosim/nudge): a Telegram bot for replies and documents you're waiting on.
- [gitlab-discord-team-watch](https://github.com/Abulkosim/gitlab-discord-team-watch): GitLab team activity in Discord, with a daily digest of merge requests waiting for review. No dependencies.
- [skills](https://github.com/Abulkosim/skills): reusable agent skills for merge request descriptions, release notes and meeting summaries.

<sub>The cards are SVGs that <a href="scripts/render.mjs">scripts/render.mjs</a> draws from the GitHub API every six hours. No third-party services. Downloads count installers only, not update checks.</sub>
