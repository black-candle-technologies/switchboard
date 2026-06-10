# Switchboard

Switchboard is a Next.js, Prisma, and TypeScript project for generating
database-backed admin resources and routes from a Prisma schema. The CLI is
published as
[`@lanebucher/switchboard`](https://www.npmjs.com/package/@lanebucher/switchboard).

## Local Development

Requirements:

- Node.js 18 or newer
- npm

Set up the repository:

```bash
git clone https://github.com/black-candle-technologies/switchboard.git
cd switchboard
npm install
```

Create the local environment file:

```bash
cp .env.example .env
```

On PowerShell, use:

```powershell
Copy-Item .env.example .env
```

The SQLite connection must be:

```dotenv
DATABASE_URL="file:./dev.db"
```

Prisma resolves that path relative to `src/prisma/schema.prisma`, so the local
database is created at `src/prisma/dev.db`.

Initialize and seed the database, then start the app:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000/admin`. The generated resource routes are under
`/admin/<resource>`, for example `/admin/users`.

## CLI Development

Link the CLI from this repository:

```bash
cd packages/cli
npm install
npm link
```

Then run it from the root of a compatible Next.js project:

```bash
switchboard generate --pages
```

To test the published package without linking it globally:

```bash
npx @lanebucher/switchboard generate --pages
```

The CLI expects the Prisma schema at `src/prisma/schema.prisma`.

## Generated Output

`generate` always writes:

```text
src/switchboard/generated/<Model>Resource.ts
src/switchboard/registry.ts
```

With `--pages`, it also writes:

```text
src/app/admin/page.tsx
src/app/admin/layout.tsx          # created only when it does not exist
src/app/admin/<models>/page.tsx
src/app/admin/<models>/new/page.tsx
src/app/admin/<models>/[id]/edit/page.tsx
```

The current CLI generates project-specific files rather than installing a
standalone admin framework. Generated pages import host-project modules such as
`@/lib/prisma`, `@/components/form/SmartForm`,
`@/components/table/SimpleTable`, and `@/switchboard/types`. A target project
must provide compatible versions of those modules.

Use `--model` to limit generation to one Prisma model:

```bash
npx @lanebucher/switchboard generate --model User --pages
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Next.js app. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Create a production build. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:migrate` | Apply local Prisma migrations. |
| `npm run db:seed` | Seed the local SQLite database. |

## License

MIT
