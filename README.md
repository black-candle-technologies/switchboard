# Switchboard

**Switchboard** is a modular, open-source admin panel and API
scaffolding generator designed for modern web applications built with
**Next.js**, **Prisma**, and **TypeScript**. It lets developers spin up
fully functional, database-driven admin dashboards in seconds --- and
extend or customize them with minimal effort.

**NPM PACKAGE** https://www.npmjs.com/package/@lanebucher/switchboard

------------------------------------------------------------------------

## Features

-   **Auto-generation**: Generate CRUD admin pages for any Prisma
    model instantly.
-   **Type-safe forms and tables** powered by Zod and TypeScript.
-   **Composable architecture** -- designed for integration into
    existing projects.
-   **Automatic registry**: Keeps all generated resources neatly
    tracked.
-   **Smart CLI**: Built using Commander.js, fs-extra, and Prettier
    for smooth operation.
-   **Minimal styling** with TailwindCSS out of the box --- easily
    replaceable.

------------------------------------------------------------------------

## Getting Started

### 1. Clone the Repository

``` bash
git clone https://github.com/LaneBucher/switchboard.git
cd switchboard
```

### 2. Install Dependencies

``` bash
npm install
```

### 3. Link the CLI Locally (for development/testing)

``` bash
cd packages/cli
npm link
```

This will globally register the `switchboard` command.

### 4. Run Switchboard in a Project

Inside any **Next.js + Prisma** project with a valid `schema.prisma`,
run:

``` bash
switchboard generate --pages
```

This will create:

-   Resource definitions under `src/switchboard/generated`
-   Admin pages under `src/app/admin` (with list, new, and edit views)
-   An automatic `registry.ts` linking all generated resources

------------------------------------------------------------------------

## Development Workflow

Switchboard uses a monorepo layout:

    switchboard/
    ├── packages/
    │   └── cli/        # CLI package (published to npm as @lanebucher/switchboard)
    ├── src/            # Core logic and shared utilities
    ├── prisma/         # Example schema and seed files
    └── README.md

### Commands

  Command                  Description
  ------------------------ ---------------------------------------------
  `npm run dev`            Starts the Next.js app (for local testing).
  `npm run db:seed`        Seeds the local SQLite database.
  `switchboard generate`   Generates new resources and pages.

------------------------------------------------------------------------

## Publishing the CLI

### Step 1: Increment the Version

``` bash
npm version patch -m "chore(release): %s"
```

### Step 2: Publish to npm

``` bash
npm publish --access public
```

Ensure your `package.json` in `packages/cli` has the correct scope and
metadata (e.g., `@lanebucher/switchboard`).

------------------------------------------------------------------------

## Testing Locally in Another Project

1.  Run this in your Switchboard repo root:

    ``` bash
    cd packages/cli
    npm link
    ```

2.  Then in another project:

    ``` bash
    npm link @lanebucher/switchboard
    ```

Now you can use `switchboard generate` directly in that project.

------------------------------------------------------------------------

## License

This project is licensed under the **MIT License**.

**Copyright (c) 2025 Lane Bucher**\
Email: <lane.bucher15@gmail.com>

------------------------------------------------------------------------

## Contributing

Contributions, issues, and feature requests are welcome.\
Feel free to open a pull request or submit an issue on GitHub.
