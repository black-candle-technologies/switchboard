# Contributing to Switchboard

## Setup
- Node 20+ (or 18+ if tested)
- npm 9+

## Dev Loop
```bash
# Run inside an example app
npx switchboard generate --pages
npm run dev
```

## Commit Style
- Conventional commits:
  - `feat:` new feature
  - `fix:` bug fix
  - `chore:` meta/config work
  - `docs:` documentation changes
  - `refactor:` code restructuring
  - `perf:` performance improvements
  - `test:` test-related work

## Release Process
- Bump version in `packages/cli/package.json`:
  ```bash
  npm version <patch|minor|major>
  ```
- Publish the CLI:
  ```bash
  cd packages/cli
  npm publish --access public
  ```
- Tag the release:
  ```bash
  git tag cli-vX.Y.Z
  git push origin cli-vX.Y.Z
  ```
```

---

## Changelog (CHANGELOG.md)
```md
# Changelog

## 0.4.1
- Added registry + overrides system
- Introduced relation selects, search, and pagination
- Added sortable columns
- Fixed admin layout hydration issues
- Improved CLI directory and template generation
```

---

## GitHub Action for Automatic Publishing
Create the following file at:
```
.github/workflows/publish-cli.yml
```

```yaml
name: Publish CLI

on:
  push:
    tags:
      - "cli-v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: packages/cli
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Then create an **NPM_TOKEN** secret in your GitHub repo settings.  
To release:
```bash
git tag cli-v0.4.2
git push origin cli-v0.4.2
```

---

## README Enhancement (root-level)
Add a section like this to your main `README.md`:

```md
## Install
```bash
npm i -D @lanebucher/switchboard
```

## Generate an Admin
```bash
switchboard generate --pages
npm run dev
# Visit /admin in your app
```
```

---

## Node Version Enforcement
Add to `packages/cli/package.json`:
```json
"engines": { "node": ">=18" }
```

---

## Troubleshooting Section
Add this to your CLI README or docs:
```md
### Troubleshooting
- **Command not found: switchboard**
  Run `npx switchboard --help` or reinstall the package.

- **Hydration errors in /admin**
  Ensure the nested layout doesn’t render its own `<html>` or `<body>` tags.

- **Prisma cannot find schema**
  Switchboard expects it at `src/prisma/schema.prisma`.
```

---