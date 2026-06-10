export function parsePrismaSchema(schema, schemaPath) {
  const enumMatches = [...schema.matchAll(/enum\s+(\w+)\s*{([^}]*)}/g)];
  const enums = {};
  for (const [, name, body] of enumMatches) {
    const values = body
      .split(/\r?\n/g)
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .map((line) => line.match(/^(\w+)\b/)?.[1])
      .filter(Boolean);
    enums[name] = values;
  }

  const modelMatches = [...schema.matchAll(/model\s+(\w+)\s*{([\s\S]*?)}/g)];
  if (modelMatches.length === 0) {
    throw new Error(
      `No Prisma models found in "${schemaPath}". ` +
        "Check that the schema is valid and contains at least one model block.",
    );
  }

  const models = modelMatches.map(([, name, body]) => {
    const fieldMatches = [
      ...body.matchAll(/^\s*(\w+)\s+([A-Za-z0-9\[\]]+\??)(.*)$/gm),
    ];
    const fields = fieldMatches.map(([, fieldName, fieldType, attributes]) => ({
      name: fieldName,
      type: fieldType.trim(),
      attrs: attributes.trim(),
    }));
    const idFields = fields.filter((field) =>
      /(?:^|\s)@id(?:\s|$|\()/.test(field.attrs),
    );
    const compoundIdMatch = body.match(/@@id\s*\(\s*\[([^\]]+)\]/);
    const compoundIdFields = compoundIdMatch
      ? compoundIdMatch[1]
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean)
      : [];
    const hasCreatedAt = fields.some(
      (field) => field.name === "createdAt" && field.type === "DateTime",
    );

    return {
      name,
      fields,
      idField: idFields.length === 1 ? idFields[0] : undefined,
      idFields,
      compoundIdFields,
      hasCreatedAt,
    };
  });

  return { enums, models };
}
