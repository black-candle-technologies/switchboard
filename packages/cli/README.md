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

## Usage

Run the CLI from the target project's root:

```bash
npx switchboard generate --pages
```

Generate only one model:

```bash
npx switchboard generate --model User --pages
```

| Option | Description |
| --- | --- |
| `-m, --model <modelName>` | Generate only the named Prisma model. |
| `--pages` | Also generate Next.js admin routes. |

Without `--pages`, the CLI generates resource configs and updates the resource
registry.

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

The generated code expects the target project to provide compatible modules at
these import paths:

- `@/lib/prisma`
- `@/components/form/SmartForm`
- `@/components/table/SimpleTable`
- `@/switchboard/types`
- `@/switchboard/overrides`

The package currently generates source files only; it does not install those
host-project modules or their dependencies.

## Links

- [Repository](https://github.com/black-candle-technologies/switchboard)
- [Issues](https://github.com/black-candle-technologies/switchboard/issues)
- [npm](https://www.npmjs.com/package/@lanebucher/switchboard)

## License

MIT
