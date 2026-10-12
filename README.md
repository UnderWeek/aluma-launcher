# Aluma Launcher

An independent Minecraft: Java Edition launcher built with Electron and plain
JavaScript. Aluma organizes separate game instances and supports Vanilla,
Fabric, mod browsing, and Microsoft account sign-in.

**Status:** in development. Packaged downloads are not available yet. Microsoft
sign-in is implemented, but the application's Minecraft Services API access
still needs approval; online sign-in currently receives HTTP 403.

## Run locally

```sh
npm ci
npm start
```

## User data

Settings, accounts, game versions, libraries, Java runtimes, and Electron data
live under the user's home directory:

- macOS/Linux: `~/.aluma/`
- Windows: `%USERPROFILE%\.aluma\`
- Instances: `.aluma/instances/<name>/minecraft/`

Existing repository-local `data/` is copied to `.aluma` on the first migration
when the destination does not exist; the old folder remains as a backup.
Users can select a custom instances directory in Settings.

## Authentication and API configuration

Aluma's public Microsoft application ID is in `src/core/auth-config.js`.
The sign-in window uses authorization code flow with PKCE. Client IDs are
public identifiers; do not add a client secret to this desktop application.

For CurseForge, use the application's Services settings or `CF_API_KEY`.
An optional `src/core/keys.local.js` is supported for local development and is
ignored by Git. Never publish keys, account tokens, or user data.

## Checks

```sh
node test/auth.js
node test/data-dir.js
node test/curseforge-key.js
node test/keys.js
```

The first three scripts use isolated fixtures. The translation checker reports
missing keys and malformed rows; dynamic key prefixes may appear in its output.

## Website

GitHub Pages serves `docs/`. The custom domain is `aluma.lostcat.online`.
See `docs/DEPLOYMENT.md` for DNS setup.

## Contributing

See [AGENTS.md](AGENTS.md). Report bugs and questions through
[GitHub Issues](https://github.com/UnderWeek/aluma-launcher/issues).

Aluma Launcher is not an official Minecraft product and is not affiliated with
or approved by Mojang or Microsoft. Minecraft is a trademark of its owners.
