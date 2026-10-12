# Repository Guidelines

## Project Structure & Module Organization

This Minecraft launcher uses Electron and plain JavaScript. `main.js` owns the application window and IPC handlers; `preload.js` exposes the `window.launcher` bridge. Backend modules in `src/core/` handle authentication, downloads, Java, versions, instances, and mods. `src/ui/` contains HTML, CSS, renderer scripts, and the translation dictionary (`i18n.js`). `test/` contains smoke scripts and screenshot scenarios. `data/` holds mutable configuration, downloaded game assets, runtimes, and instances; treat it as local application state.

## Build, Test, and Development Commands

Run commands from the repository root:

- `npm ci`: install dependencies from `package-lock.json`.
- `npm start`: launch the Electron application.
- `node test/keys.js`: report missing translation keys and malformed dictionary rows.
- `npx electron test/backend.js`: exercise instance creation, mod installation, duplication, movement, and cleanup; requires network access.
- `npx electron test/shoot.js`: run the default UI scenario and save PNGs in `test/shots/`.
- `STEPS=test/steps-flow.js npx electron test/shoot.js`: select a different UI scenario.

There are no build, packaging, lint, or `npm test` scripts configured.

## Coding Style & Naming Conventions

Match existing JavaScript: two-space indentation, single quotes, no trailing semicolons, and `const` unless reassignment is needed. Use CommonJS in backend and Electron entry files. Prefer camelCase functions and variables, and short lowercase module filenames. Keep filesystem and process operations in the backend, accessed through explicit preload methods. Add user-facing strings to `src/ui/i18n.js` and preserve its language ordering.

## Testing Guidelines

Tests are standalone scripts, without a test framework or coverage threshold. Add UI scenarios as `test/steps-<feature>.js`, exporting an async function that accepts the screenshot harness context. Inspect logs and screenshots: the harness can log `STEP ERROR` while exiting successfully, and the translation checker reports issues without failing. Backend and UI scenarios can modify `data/config.json` and instances; use disposable state for testing.

## Commit & Pull Request Guidelines

Git metadata is absent from this checkout, so existing commit conventions cannot be verified. Use concise imperative subjects, such as `Fix instance launch cancellation`. Describe behavior changes, relevant issues, and commands run in PRs. Include screenshots for UI changes. Keep credentials, account tokens, downloaded binaries, and generated screenshots out of commits.
