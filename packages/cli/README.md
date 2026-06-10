# @lanebucher/switchboard

Version 0.4.2

Switchboard generates Prisma-backed resource configuration and optional
Next.js App Router admin pages.

## Requirements

- Node.js 18 or newer
- A Next.js and Prisma project using TypeScript
- A Prisma schema at `src/prisma/schema.prisma`

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
npx prisma migrate dev --schema src/prisma/schema.prisma
npx prisma generate --schema src/prisma/schema.prisma
npx switchboard generate --pages
npm run dev
```

Open `http://localhost:3000/admin`.

The project must already have a `src/app` directory. Switchboard currently
generates source files and expects compatible host-project support modules; see
[Project Requirements](#project-requirements).

## Usage

| Option | Description |
| --- | --- |
| `-m, --model <modelName>` | Generate only the named Prisma model. |
| `--schema <path>` | Prisma schema path relative to the project root. Defaults to `src/prisma/schema.prisma`. |
| `--out <path>` | Switchboard output directory inside `src`. Defaults to `src/switchboard`. |
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
remain under `src/app/admin`. Custom output directories must stay inside `src`
because generated files use the project’s `@/` import alias.

## Generated Files

```text
src/
|-- switchboard/
|   |-- generated/
|   |   |-- UserResource.ts
|   |   `-- PostResource.ts
|   `-- registry.ts
`-- app/
    `-- admin/
        |-- layout.tsx
        |-- page.tsx
        `-- users/
            |-- page.tsx
            |-- new/
            |   `-- page.tsx
            `-- [id]/
                `-- edit/
                    `-- page.tsx
```

The `src/app/admin` files are generated only with `--pages`.
`src/app/admin/layout.tsx` is preserved when it already exists; the other
listed generated files are overwritten.

Generated files are owned by the developer and can be edited. Be aware that
running the generator again overwrites resource configs, the registry, admin
list/new/edit pages, and the admin index.

## Project Requirements

The generated code expects the target project to provide compatible modules at
these import paths:

- `@/lib/prisma`
- `@/components/form/SmartForm`
- `@/components/table/SimpleTable`
- `@/switchboard/types`
- `@/switchboard/overrides`

The package currently generates source files only; it does not install those
host-project modules or their dependencies.

When using `--out src/admin-kit`, the `types` and `overrides` modules must exist
under `src/admin-kit`; page support modules such as `@/lib/prisma` and
`@/components/form/SmartForm` keep their standard paths.

Models used with `--pages` must have one explicit `String`, `Int`, or `BigInt`
primary key. Compound IDs are rejected with an actionable error.

## Links

- [Repository](https://github.com/black-candle-technologies/switchboard)
- [Issues](https://github.com/black-candle-technologies/switchboard/issues)
- [npm](https://www.npmjs.com/package/@lanebucher/switchboard)

## License

MIT
