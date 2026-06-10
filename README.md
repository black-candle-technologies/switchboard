# Switchboard

Switchboard is a Next.js, Prisma, and TypeScript project for generating
database-backed admin resources and routes from a Prisma schema. The CLI is
published as
[`@lanebucher/switchboard`](https://www.npmjs.com/package/@lanebucher/switchboard).

## Quick Start

From an existing Next.js App Router and Prisma project:

```bash
npm install --save-dev @lanebucher/switchboard
```

Set the database connection in `.env`. For SQLite with the default schema
location:

```dotenv
DATABASE_URL="file:./dev.db"
```

Create the database, generate the Prisma client, and run Switchboard:

```bash
npx prisma migrate dev --schema src/prisma/schema.prisma
npx prisma generate --schema src/prisma/schema.prisma
npx switchboard generate --pages
npm run dev
```

Open `http://localhost:3000/admin`.

Switchboard currently generates project source files rather than installing a
complete runtime. Before generated pages compile, the project must provide the
compatible support modules listed under [Generated Output](#generated-output).

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

The defaults expect the Prisma schema at `src/prisma/schema.prisma`, write
Switchboard files under `src/switchboard`, and write pages under
`src/app/admin`.

```bash
switchboard generate [options]
```

| Option | Description |
| --- | --- |
| `-m, --model <name>` | Generate only one Prisma model. |
| `--schema <path>` | Schema path relative to the project root. |
| `--out <path>` | Switchboard output root inside `src`. |
| `--pages` | Also generate App Router admin pages. |

Example with custom paths:

```bash
npx switchboard generate \
  --schema prisma/schema.prisma \
  --out src/admin-kit \
  --pages
```

`--out` changes the resource and registry location. Admin pages remain under
`src/app/admin`.

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

Generated files belong to the project and can be edited. Re-running generation
overwrites resource configs, the registry, admin list/new/edit pages, and the
admin index. An existing `src/app/admin/layout.tsx` is preserved.

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
