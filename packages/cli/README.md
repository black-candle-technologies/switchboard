# @lanebucher/switchboard


**Version:** 0.4.0
**Author:** Lane Bucher
**Contact:** lane.bucher15@gmail.com
**License:** MIT License


---


## Overview
Switchboard is an open-source developer toolkit that automatically generates a complete, fully customizable admin dashboard for your **Next.js + Prisma** application. It is designed to save time during early-stage development by transforming your existing Prisma schema into an interactive, type-safe admin panel in seconds.


Unlike Prisma Studio, Switchboard is focused on **extensibility and design freedom**. It generates actual Next.js pages and React components, which can be modified, extended, or themed as needed. You retain complete control over the resulting code.


---


## Features
- Instant generation of CRUD admin pages for all Prisma models.
- Full integration with Next.js App Router and TypeScript.
- Automatically detects model relationships, enums, and validation.
- Supports pagination, sorting, and filtering out of the box.
- Generates strongly typed resource configs for each model.
- Produces editable pages that can be extended like any other component.
- CLI-based generation workflow for repeatable use in production apps.


---


## Installation
To install the CLI:


```bash
npm install -D @lanebucher/switchboard
```


---


## Usage
Switchboard assumes your Prisma schema is located at `src/prisma/schema.prisma`.


Run the CLI from your Next.js project root:


```bash
switchboard generate --pages
```


### Options
| Flag | Description |
|------|--------------|
| `--pages` | Generates full Next.js admin pages in addition to resource configs. |
| `--model <ModelName>` | Generate code for a specific Prisma model only. |


Example:
```bash
switchboard generate --model User --pages
```


---


## Output Structure
After running `switchboard generate --pages`, Switchboard will produce the following:


```
src/
prisma/
schema.prisma
switchboard/
generated/
UserResource.ts
PostResource.ts
...
registry.ts
app/
admin/
users/
page.tsx
new/page.tsx
[id]/edit/page.tsx
layout.tsx
```

## For questions, feature requests, or contributions, please open an issue on GitHub or reach out directly via email.