function errorHelper(modelName) {
  return `
    function actionErrorMessage(error: unknown, operation: "save" | "delete") {
      console.error(\`Switchboard failed to \${operation} ${modelName}:\`, error);
      if (error instanceof SyntaxError) {
        return "A JSON field contains invalid JSON.";
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return "A record with that unique value already exists.";
        }
        if (error.code === "P2003") {
          return operation === "delete"
            ? "This record cannot be deleted because other records still reference it."
            : "A selected related record no longer exists.";
        }
        if (error.code === "P2025") return "This record no longer exists.";
      }
      return operation === "delete"
        ? "The record could not be deleted."
        : "The record could not be saved. Check the values and try again.";
    }
  `;
}

function relationParts(relations) {
  const variableNames = relations.map(
    (relation) => `${relation.relationField}Records`,
  );
  const queries = relations.map((relation) => {
    const labelSelect =
      relation.labelKey === relation.valueKey
        ? ""
        : `\n${relation.labelKey}: true,`;
    return `prisma.${relation.delegate}.findMany({
      select: {
        ${relation.valueKey}: true,${labelSelect}
      },
      orderBy: { ${relation.labelKey}: "asc" },
    })`;
  });
  const options = relations.length
    ? `const relationOptions = {
        ${relations
          .map(
            (
              relation,
            ) => `${relation.foreignKey}: ${relation.relationField}Records.map((record) => ({
              value: String(record.${relation.valueKey}),
              label: String(record.${relation.labelKey} ?? record.${relation.valueKey}),
            }))`,
          )
          .join(",\n")}
      };`
    : "const relationOptions = {};";

  return { variableNames, queries, options };
}

function listTemplate(options) {
  const {
    columns,
    deleteButtonImport,
    delegate,
    idName,
    idValueExpression,
    marker,
    modelName,
    plural,
    listPrismaImport,
    relations,
    listResourceImport,
    searchable,
    sortable,
  } = options;
  const includeEntries = relations
    .map((relation) => {
      const labelSelect =
        relation.labelKey === relation.valueKey
          ? ""
          : `, ${relation.labelKey}: true`;
      return `${relation.relationField}: { select: { ${relation.valueKey}: true${labelSelect} } }`;
    })
    .join(",\n");
  const listRowType = relations.length
    ? `const relationInclude = {
        ${includeEntries}
      } satisfies Prisma.${modelName}Include;
      type ListRow = Prisma.${modelName}GetPayload<{
        include: typeof relationInclude;
      }>;`
    : `type ListRow = ${modelName};`;
  const include = relations.length ? "include: relationInclude," : "";

  return `
    // ${marker}
    import { prisma } from "${listPrismaImport}";
    import Link from "next/link";
    import { revalidatePath } from "next/cache";
    import { DeleteButton } from "${deleteButtonImport}";
    import { ${modelName}Resource } from "${listResourceImport}";
    import { Prisma${relations.length ? "" : `, type ${modelName}`} } from "@prisma/client";

    type SearchParams = Record<string, string | string[] | undefined>;
    type PageProps = { searchParams: Promise<SearchParams> };
    type GeneratedColumn = {
      key: string;
      header?: string;
      format?: "datetime" | "date" | "boolean" | "json" | "relation";
      relationField?: string;
      relationLabelKey?: string;
    };
    ${listRowType}
    ${errorHelper(modelName)}

    function displayValue(value: unknown, format?: GeneratedColumn["format"]) {
      if (value === null || value === undefined || value === "") {
        return <span className="sb-null-value">Not set</span>;
      }
      if (format === "boolean") return value ? "Yes" : "No";
      if (format === "datetime" || format === "date") {
        const date = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(date.getTime())) return String(value);
        return format === "date"
          ? date.toLocaleDateString()
          : date.toLocaleString();
      }
      if (format === "json" || typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }
      return String(value);
    }

    export default async function ${modelName}ListPage({
      searchParams,
    }: PageProps) {
      const params = await searchParams;
      const q =
        typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
      const requestedPage = Number(
        typeof params.page === "string" ? params.page : "1",
      );
      const safeRequestedPage =
        Number.isSafeInteger(requestedPage) && requestedPage > 0
          ? requestedPage
          : 1;
      const configuredTake = ${modelName}Resource.list?.perPage ?? 20;
      const take = Math.min(100, Math.max(1, Math.trunc(configuredTake)));

      const supportedSearchFields = new Set(${JSON.stringify(searchable)});
      const searchable = (
        ${modelName}Resource.list?.searchable ?? ${JSON.stringify(searchable)}
      ).filter((field) => supportedSearchFields.has(field));
      const supportedSortFields = new Set(${JSON.stringify(sortable)});
      const sortable = (
        ${modelName}Resource.list?.sortable ?? ${JSON.stringify(sortable)}
      ).filter((field) => supportedSortFields.has(field));
      const configuredDefaultSort = ${modelName}Resource.list?.defaultSort;
      const defaultSortKey =
        configuredDefaultSort && sortable.includes(configuredDefaultSort.key)
          ? configuredDefaultSort.key
          : "";
      const defaultSortDir: "asc" | "desc" =
        configuredDefaultSort?.dir === "asc" ? "asc" : "desc";
      const requestedSort =
        typeof params.sort === "string" ? params.sort : "";
      const sortKey = sortable.includes(requestedSort)
        ? requestedSort
        : defaultSortKey;
      const sortDir =
        params.dir === "asc" || params.dir === "desc"
          ? params.dir
          : defaultSortDir;
      const orderBy = (sortKey
        ? { [sortKey]: sortDir }
        : undefined) as
        | Prisma.${modelName}OrderByWithRelationInput
        | undefined;
      const where = (
        q && searchable.length
          ? {
              OR: searchable.map((field) => ({
                [field]: { contains: q },
              })),
            }
          : {}
      ) as Prisma.${modelName}WhereInput;

      const total = await prisma.${delegate}.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / take));
      const page = Math.min(safeRequestedPage, totalPages);
      const items: ListRow[] = await prisma.${delegate}.findMany({
        where,
        orderBy,
        skip: (page - 1) * take,
        take,
        ${include}
      });
      const columns = (
        ${modelName}Resource.list?.columns ?? ${JSON.stringify(columns, null, 2)}
      ) as readonly GeneratedColumn[];

      async function del(
        _previousState: { error?: string },
        formData: FormData,
      ) {
        "use server";
        try {
          const rawId = formData.get("${idName}");
          if (typeof rawId !== "string" || !rawId) {
            return { error: "The record identifier is missing." };
          }
          await prisma.${delegate}.delete({
            where: { ${idName}: ${idValueExpression} },
          });
        } catch (error) {
          return { error: actionErrorMessage(error, "delete") };
        }
        revalidatePath("/admin/${plural}");
        return {};
      }

      const queryString = (
        next: Partial<{
          page: number;
          sort: string;
          dir: "asc" | "desc";
        }>,
      ) => {
        const query = new URLSearchParams();
        if (q) query.set("q", q);
        query.set("page", String(next.page ?? page));
        const nextSort = next.sort ?? sortKey;
        if (nextSort && sortable.includes(nextSort)) {
          query.set("sort", nextSort);
          query.set("dir", next.dir ?? sortDir);
        }
        return \`?\${query.toString()}\`;
      };

      const header = (column: GeneratedColumn) => {
        if (!sortable.includes(column.key)) {
          return column.header ?? column.key;
        }
        const active = sortKey === column.key;
        const nextDir = active && sortDir === "asc" ? "desc" : "asc";
        return (
          <a
            className="sb-action-link"
            href={queryString({
              page: 1,
              sort: column.key,
              dir: nextDir,
            })}
          >
            {column.header ?? column.key}
            {active ? (sortDir === "asc" ? " (asc)" : " (desc)") : ""}
          </a>
        );
      };

      return (
        <section className="sb-page">
          <div className="sb-page-header">
            <div>
              <p className="sb-eyebrow">Resource</p>
              <h1 className="sb-page-title">${modelName}s</h1>
              <p className="sb-page-description">
                View, search, and manage ${modelName.toLowerCase()} records.
              </p>
            </div>
            <Link href="/admin/${plural}/new" className="sb-button">
              + New
            </Link>
          </div>

          {searchable.length ? (
            <form method="get" className="sb-search-form">
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder={"Search " + searchable.join(", ")}
                className="sb-input"
              />
              {sortKey ? (
                <input type="hidden" name="sort" value={sortKey} />
              ) : null}
              {sortKey ? (
                <input type="hidden" name="dir" value={sortDir} />
              ) : null}
              <button
                className="sb-button sb-button-secondary"
                type="submit"
              >
                Search
              </button>
              {q ? (
                <Link className="sb-action-link" href="/admin/${plural}">
                  Clear
                </Link>
              ) : null}
            </form>
          ) : null}

          <div className="sb-table-wrap">
            <table className="sb-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{header(column)}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const values = row as unknown as Record<string, unknown>;
                  return (
                    <tr key={String(values.${idName})}>
                      {columns.map((column) => {
                        const related =
                          column.format === "relation" &&
                          column.relationField
                            ? (values[column.relationField] as
                                | Record<string, unknown>
                                | null
                                | undefined)
                            : undefined;
                        const value =
                          related && column.relationLabelKey
                            ? related[column.relationLabelKey]
                            : values[column.key];
                        return (
                          <td key={column.key}>
                            {displayValue(value, column.format)}
                          </td>
                        );
                      })}
                      <td>
                        <div className="sb-actions">
                          <Link
                            className="sb-table-action"
                            href={
                              "/admin/${plural}/" +
                              encodeURIComponent(String(values.${idName})) +
                              "/edit"
                            }
                          >
                            Edit
                          </Link>
                          <DeleteButton
                            action={del}
                            idName="${idName}"
                            idValue={String(values.${idName})}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 ? (
                  <tr>
                    <td
                      className="sb-empty-state"
                      colSpan={columns.length + 1}
                    >
                      {q
                        ? \`No ${modelName.toLowerCase()} records match "\${q}".\`
                        : "No ${modelName.toLowerCase()} records yet. Create one to get started."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="sb-pagination">
            <span>
              Page {page} of {totalPages} ({total}{" "}
              {total === 1 ? "record" : "records"})
            </span>
            <div className="sb-pagination-actions">
              {page > 1 ? (
                <a
                  className="sb-pagination-link"
                  href={queryString({ page: page - 1 })}
                >
                  Previous
                </a>
              ) : (
                <span className="sb-pagination-link sb-is-disabled">
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <a
                  className="sb-pagination-link"
                  href={queryString({ page: page + 1 })}
                >
                  Next
                </a>
              ) : (
                <span className="sb-pagination-link sb-is-disabled">
                  Next
                </span>
              )}
            </div>
          </div>
        </section>
      );
    }
  `;
}

function newTemplate(options) {
  const {
    newAuthImport,
    createFields,
    delegate,
    marker,
    modelName,
    plural,
    newPrismaImport,
    relations,
    newResourceImport,
    newSmartFormImport,
  } = options;
  const relation = relationParts(relations);
  const relationLoad = relations.length
    ? `const [${relation.variableNames.join(", ")}] = await Promise.all([
        ${relation.queries.join(",\n")}
      ]);`
    : "";

  return `
    // ${marker}
    import { prisma } from "${newPrismaImport}";
    import { revalidatePath } from "next/cache";
    import { redirect } from "next/navigation";
    import { SmartForm } from "${newSmartFormImport}";
    import { ${modelName}Resource } from "${newResourceImport}";
    ${newAuthImport ? `import { hashPassword } from "${newAuthImport}";` : ""}
    import { Prisma } from "@prisma/client";

    ${errorHelper(modelName)}

    export default async function New${modelName}Page() {
      ${relationLoad}
      ${relation.options}

      async function create(
        _previousState: { error?: string },
        formData: FormData,
      ) {
        "use server";
        try {
          const data: Prisma.${modelName}UncheckedCreateInput = {
            ${createFields.join(",\n")}
          };
          await prisma.${delegate}.create({ data });
        } catch (error) {
          return { error: actionErrorMessage(error, "save") };
        }
        revalidatePath("/admin/${plural}");
        redirect("/admin/${plural}");
      }

      return (
        <SmartForm
          title="New ${modelName}"
          fields={${modelName}Resource.fields}
          relationOptions={relationOptions}
          submitLabel="Create"
          cancelHref="/admin/${plural}"
          action={create}
        />
      );
    }
  `;
}

function editTemplate(options) {
  const {
    editAuthImport,
    delegate,
    editFields,
    idExpression,
    idName,
    jsonFields,
    marker,
    modelName,
    plural,
    editPrismaImport,
    relations,
    editResourceImport,
    editSmartFormImport,
  } = options;
  const relation = relationParts(relations);
  const promiseItems = [
    `prisma.${delegate}.findUnique({ where: { ${idName}: id } })`,
    ...relation.queries,
  ];
  const resultNames = ["existing", ...relation.variableNames];

  return `
    // ${marker}
    import { prisma } from "${editPrismaImport}";
    import { revalidatePath } from "next/cache";
    import { redirect } from "next/navigation";
    import { SmartForm } from "${editSmartFormImport}";
    import { ${modelName}Resource } from "${editResourceImport}";
    ${editAuthImport ? `import { hashPassword } from "${editAuthImport}";` : ""}
    import { Prisma } from "@prisma/client";

    type PageProps = { params: Promise<{ id: string }> };
    ${errorHelper(modelName)}

    export default async function Edit${modelName}Page({
      params,
    }: PageProps) {
      const routeParams = await params;
      const id = ${idExpression};
      const [${resultNames.join(", ")}] = await Promise.all([
        ${promiseItems.join(",\n")}
      ]);
      if (!existing) {
        return <div className="sb-card sb-empty-state">Record not found.</div>;
      }
      ${relation.options}

      async function update(
        _previousState: { error?: string },
        formData: FormData,
      ) {
        "use server";
        try {
          const data: Prisma.${modelName}UncheckedUpdateInput = {
            ${editFields.join(",\n")}
          };
          await prisma.${delegate}.update({
            where: { ${idName}: id },
            data,
          });
        } catch (error) {
          return { error: actionErrorMessage(error, "save") };
        }
        revalidatePath("/admin/${plural}");
        redirect("/admin/${plural}");
      }

      const jsonFields = new Set<string>(${JSON.stringify(jsonFields)});
      const initialValues = Object.fromEntries(
        Object.entries(existing).map(([key, value]) => [
          key,
          ${
            editAuthImport
              ? `["password", "passwordHash"].includes(key)
            ? ""
            : `
              : ""
          }value instanceof Date
            ? value.toISOString().slice(0, 16)
            : typeof value === "bigint"
              ? String(value)
              : jsonFields.has(key) && value !== null
                ? JSON.stringify(value, null, 2)
                : value,
        ]),
      );

      return (
        <SmartForm
          title="Edit ${modelName}"
          fields={${modelName}Resource.fields}
          initialValues={initialValues}
          relationOptions={relationOptions}
          submitLabel="Save"
          cancelHref="/admin/${plural}"
          action={update}
        />
      );
    }
  `;
}

export function runtimeTemplates(options) {
  return {
    listPage: listTemplate(options),
    newPage: newTemplate(options),
    editPage: editTemplate(options),
  };
}
