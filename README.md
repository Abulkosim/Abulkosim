<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/e2614226651cd2221b6d8ec0de1eca345ac77471/apps-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/e2614226651cd2221b6d8ec0de1eca345ac77471/apps-light.svg" alt="Apps: Margin, Claude Code and Codex usage limits across accounts. Wick, keeps your computer awake. Weir, internet speed and connection checks from the menu bar. Tonearm, a mini player for the Spotify desktop app in the menu bar. With downloads, stars and the last release of each." width="840" />
</picture>
<a href="https://github.com/Abulkosim/typeprose">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/e2614226651cd2221b6d8ec0de1eca345ac77471/typeprose-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/e2614226651cd2221b6d8ec0de1eca345ac77471/typeprose-light.svg" alt="typeprose: typing practice on real prose from public-domain books, showing today's passage mid-run" width="840" />
</picture>
</a>
<a href="https://github.com/Abulkosim/earthrise">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/e2614226651cd2221b6d8ec0de1eca345ac77471/earthrise-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/e2614226651cd2221b6d8ec0de1eca345ac77471/earthrise-light.svg" alt="Earthrise: sunlight, Earth contact and power at the Moon's south pole, a team project that took first place in Uzbekistan at NASA Space Apps 2026 and goes to the global round next, with a screenshot of the app" width="840" />
</picture>
</a>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Abulkosim/Abulkosim/e2614226651cd2221b6d8ec0de1eca345ac77471/cadence-dark.svg" />
  <img src="https://raw.githubusercontent.com/Abulkosim/Abulkosim/e2614226651cd2221b6d8ec0de1eca345ac77471/cadence-light.svg" alt="Releases per day since the first release, and the latest releases" width="840" />
</picture>

### Install

```sh
brew install --cask abulkosim/tap/wick
brew install --cask abulkosim/tap/weir
brew install --cask abulkosim/tap/tonearm
```

Margin and the Windows and Linux builds are on each app's page: [Margin](https://github.com/Abulkosim/margin), [Wick](https://github.com/Abulkosim/wick), [Weir](https://github.com/Abulkosim/weir), [Tonearm](https://github.com/Abulkosim/tonearm).

### How I ship

I build every release in CI, with checksums and build provenance you can check with `gh attestation verify`. Updates are signed and install only when you say so. No telemetry. No account.

### Also

- **[realsoft-chrome-extension](https://github.com/Abulkosim/realsoft-chrome-extension)** Signs RealSoft employees in to the office Wi-Fi in one click. 73 people use it, from the [Chrome Web Store](https://chromewebstore.google.com/detail/realsoft/hhekakkemegiocboammljekhcefhfhgb).
- **[nudge](https://github.com/Abulkosim/nudge)** A Telegram bot for replies and documents you're waiting on.
- **[gitlab-discord-team-watch](https://github.com/Abulkosim/gitlab-discord-team-watch)** Posts GitLab team activity to Discord, with a daily list of merge requests waiting for review.
- **[skills](https://github.com/Abulkosim/skills)** Agent skills for merge request descriptions, release notes and meeting summaries.

<sub>The cards above are drawn from the GitHub API every six hours by [scripts/render.mjs](scripts/render.mjs), set in Inter and JetBrains Mono (SIL Open Font License). Downloads count installers, not update checks. The typeprose passage changes daily.</sub>
