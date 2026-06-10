# @lanebucher/switchboard

Version 0.4.2

Switchboard generates Prisma-backed resource configuration and optional
Next.js App Router admin pages.

## Requirements

- Node.js 18 or newer
- A Next.js and Prisma project using TypeScript
- A Prisma schema at `src/prisma/schema.prisma` or `prisma/schema.prisma`
- An `@/*` alias targeting the project’s source root

## Installation

```bash
npm install --save-dev @lanebucher/switchboard
```

## Quick Start

In an existing Next.js App Router and Prisma project, set `DATABASE_URL` in
`.env`. For SQLite with the default schema location:

```dotenv
DATABASE_URL="file:./dev.db"
```

Then run:

```bash
npm install --save-dev @lanebucher/switchboard
npx switchboard init
npx switchboard generate --pages
npm run dev
```

Open `http://localhost:3000/admin`.

Run the normal Prisma migration and client generation commands before starting
the app. `init` supports both `src/app` and root `app` projects.

## Example App

The repository includes a complete outsider-style example at
[`examples/basic-next-prisma`](../../examples/basic-next-prisma). It contains
`User` and `Post` models, SQLite setup, generated support files, and admin
list/create/edit routes.

From the repository root:

```bash
npm run example:smoke
```

## Init

`init` creates the support files used by generated pages.
This includes `app/admin/switchboard.css`, a small plain-CSS admin theme with
no styling dependency. The generated stylesheet belongs to the project and can
be edited or replaced.

| Option | Description |
| --- | --- |
| `--schema <path>` | Use a custom Prisma schema path. |
| `--app-dir <path>` | Use a custom App Router directory. |
| `--force` | Overwrite existing Switchboard support files. |
| `--dry-run` | Show what would change without writing files. |

Existing files are skipped by default.

```bash
npx switchboard init --dry-run
npx switchboard init
```

## Generate

| Option | Description |
| --- | --- |
| `-m, --model <modelName>` | Generate only the named Prisma model. |
| `--schema <path>` | Prisma schema path relative to the project root. Defaults to `src/prisma/schema.prisma`. |
| `--out <path>` | Switchboard output directory inside the detected source root. |
| `--app-dir <path>` | Use a custom App Router directory. |
| `--pages` | Also generate Next.js admin routes. |

Without `--pages`, the CLI generates resource configs and updates the resource
registry.

Examples:

```bash
npx switchboard generate --model User --pages
npx switchboard generate --schema prisma/schema.prisma --pages
npx switchboard generate --out src/admin-kit --pages
```

`--out` relocates generated resource configs and the registry. Admin pages
remain under the detected App Router directory.

## Generated Files

`init` creates:

```text
src/
|-- lib/prisma.ts
|-- switchboard/
|   |-- types.ts
|   |-- registry.ts
|   `-- overrides.ts
|-- components/
|   |-- form/SmartForm.tsx
|   `-- table/SimpleTable.tsx
`-- app/
    `-- admin/
        |-- switchboard.css
        |-- layout.tsx
        `-- page.tsx
```

Root `app` projects use `lib`, `switchboard`, and `components` at the project
root. `generate --pages` then adds:

```text
switchboard/generated/
|-- UserResource.ts
`-- PostResource.ts

app/admin/
|-- page.tsx
`-- users/
    |-- page.tsx
    |-- new/page.tsx
    `-- [id]/edit/page.tsx
```

For `src/app` projects, these paths are under `src/`.

The admin layout is preserved by `generate` when it already exists. Other
generated resource and page files are overwritten.

Generated files are owned by the developer and can be edited. `init` skips
existing files unless `--force` is provided.

## Project Requirements

`init` detects:

- `src/app` or root `app`
- `src/prisma/schema.prisma` or `prisma/schema.prisma`
- `tsconfig.json` or `jsconfig.json`
- an `@/*` alias targeting `src` or the project root

After `init`, generated code uses:

```text
@/lib/prisma
@/components/form/SmartForm
@/components/table/SimpleTable
@/switchboard/types
@/switchboard/overrides
```

Models used with `--pages` must have one explicit `String`, `Int`, or `BigInt`
primary key. Compound IDs are rejected with an actionable error.

## Links

- [Repository](https://github.com/black-candle-technologies/switchboard)
- [Issues](https://github.com/black-candle-technologies/switchboard/issues)
- [npm](https://www.npmjs.com/package/@lanebucher/switchboard)

## License

MIT
