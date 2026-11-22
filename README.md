<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/stats-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/stats-light.svg" alt="Installer downloads, releases, contributions in the past year and merged public pull requests" width="840" />
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/apps-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/apps-light.svg" alt="Apps: Margin, Claude Code and Codex usage limits across accounts. Wick, keeps your computer awake. Weir, internet speed and connection checks from the menu bar. Tonearm, a mini player for the Spotify desktop app in the menu bar. With downloads, stars and the last release of each." width="840" />
</picture>

[Margin](https://github.com/Abulkosim/margin) · [Wick](https://github.com/Abulkosim/wick) · [Weir](https://github.com/Abulkosim/weir) · [Tonearm](https://github.com/Abulkosim/tonearm)

<a href="https://github.com/Abulkosim/typeprose">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/typeprose-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/typeprose-light.svg" alt="typeprose: typing practice on real prose from public-domain books, showing today's passage mid-run" width="840" />
</picture>
</a>
<a href="https://github.com/Abulkosim/earthrise">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/earthrise-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/earthrise-light.svg" alt="Earthrise: sunlight, Earth contact and power at the Moon's south pole, a team project that took first place in Uzbekistan at NASA Space Apps 2026 and goes to the global round next, with a screenshot of the app" width="840" />
</picture>
</a>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/cadence-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/output/cadence-light.svg" alt="Releases per day since the first release, and the latest releases" width="840" />
</picture>

```sh
brew install --cask abulkosim/tap/wick
brew install --cask abulkosim/tap/weir
brew install --cask abulkosim/tap/tonearm
```

### How the apps ship

CI builds every release, with checksums and build provenance you can check with `gh attestation verify`. Updates are signed and install only when you say so. No telemetry, no account.

### Other things

- [realsoft-chrome-extension](https://github.com/Abulkosim/realsoft-chrome-extension): signs RealSoft employees in to the office Wi-Fi with one click. 73 people use it, from the [Chrome Web Store](https://chromewebstore.google.com/detail/realsoft/hhekakkemegiocboammljekhcefhfhgb).
- [nudge](https://github.com/Abulkosim/nudge): a Telegram bot for replies and documents you're waiting on.
- [gitlab-discord-team-watch](https://github.com/Abulkosim/gitlab-discord-team-watch): posts GitLab team activity to Discord, plus a daily list of merge requests waiting for review.
- [skills](https://github.com/Abulkosim/skills): agent skills for merge request descriptions, release notes and meeting summaries.

<sub>[scripts/render.mjs](scripts/render.mjs) draws these cards from the GitHub API every six hours. Downloads count installers, not update checks. The typeprose passage changes daily.</sub>
