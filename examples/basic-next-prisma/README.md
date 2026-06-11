# Basic Next.js + Prisma Example

This is a minimal outsider-style project using Next.js App Router, Prisma,
SQLite, TypeScript, and the local `@lanebucher/switchboard` package.

## Setup

From this directory:

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx switchboard init
npx switchboard generate --pages
npx switchboard auth seed-admin
npm run dev
```

PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npx prisma migrate dev
npx switchboard init
npx switchboard generate --pages
npx switchboard auth seed-admin
npm run dev
```

Open:

- `http://localhost:3000/admin`
- `http://localhost:3000/admin/users`
- `http://localhost:3000/admin/users/new`
- `http://localhost:3000/admin/posts`
- `http://localhost:3000/admin/posts/new`

The admin routes redirect to `/admin/login`. Local bootstrap credentials are:

- Username: `admin`
- Password: `password`

This password is intentionally insecure. Change it before production:

```bash
npx switchboard auth seed-admin --admin-password "use-a-strong-password"
```

`.env` must define `SWITCHBOARD_SESSION_SECRET` with at least 32 characters.
The committed `.env.example` contains a development placeholder; use a random
secret in deployed environments.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build the example app. |
| `npm run prisma:generate` | Generate Prisma Client. |
| `npm run prisma:migrate` | Create/apply the local SQLite migration. |
| `npm run switchboard:init` | Create Switchboard support files. |
| `npm run switchboard:generate` | Generate resource configs and admin pages. |
| `npm run switchboard:seed-admin` | Create or reset the local admin account. |

The Switchboard dependency uses `file:../../packages/cli`, so this example
exercises the CLI package from this repository without publishing it first.

Generated Switchboard files are checked in for inspection. Running `init`
preserves them by default; running `generate --pages` refreshes generated
resource and route files.

The admin shell uses the generated `src/app/admin/switchboard.css` stylesheet.
It is plain CSS with no framework dependency and can be edited or replaced.

The example `Post` model exercises generated enum, optional text, boolean,
number, optional DateTime, JSON, and `Post.authorId -> User` relation controls.
The author foreign key is rendered as a User select and displayed by user name
on the Post list page.

From the repository root, run the full install, migration, generation, and
build validation with:

```bash
npm run example:smoke
```
