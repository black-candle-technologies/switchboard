# Contributing to Switchboard

## Setup

Requirements:

- Node.js 18 or newer
- npm

```bash
git clone https://github.com/black-candle-technologies/switchboard.git
cd switchboard
npm install
```

Create `.env` from the example file:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

The expected local value is:

```dotenv
DATABASE_URL="file:./dev.db"
```

Initialize the local database and run the app:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Before submitting changes, run:

```bash
npm run lint
npm run build
```

## CLI Development

```bash
cd packages/cli
npm install
npm link
```

Run `switchboard generate --pages` from the root of a compatible test project.
The CLI expects its Prisma schema at `src/prisma/schema.prisma`.

## Releases

Before publishing the CLI:

```bash
npm test
npm run lint
npm run build
cd packages/cli
npm pack --dry-run
```

Confirm that the package contains only `bin`, `src`, `templates`, `README.md`,
`LICENSE`, and `package.json`. Tests, fixtures, example databases, environment
files, and local build artifacts must not be included.

For the `0.6.0-beta.1` public beta, publish with:

```bash
npm publish --access public --tag beta
```

Keep `packages/cli/package.json`, the CLI version output, and the CLI README in
sync. Tag releases as `cli-vX.Y.Z`.

## Commit Style

Use conventional commit prefixes such as `feat:`, `fix:`, `docs:`, `chore:`,
`refactor:`, and `test:`.
