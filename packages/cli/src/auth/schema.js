import fs from "fs-extra";

import { parsePrismaSchema } from "../parser/prismaSchemaParser.js";

const baseType = (type) => type.replace(/\?$/, "").replace(/\[\]$/, "");
const hasAttribute = (field, name) =>
  new RegExp(`(?:^|\\s)@${name}(?:\\s|$|\\()`).test(field.attrs);

function authSchemaError(schemaPath, details) {
  return new Error(
    `Switchboard admin authentication requires an auth-ready User model in "${schemaPath}".\n` +
      `${details.join("\n")}\n` +
      "Required fields: one scalar @id, unique String username or email, " +
      "String passwordHash or password, and an enum role containing ADMIN. " +
      "Update the Prisma schema and run a Prisma migration; Switchboard will not modify it automatically.",
  );
}

export function analyzeAuthSchema(parsed, schemaPath = "schema.prisma") {
  const user = parsed.models.find((model) => model.name === "User");
  const errors = [];
  if (!user) {
    throw authSchemaError(schemaPath, ['- Missing model "User".']);
  }

  const idField =
    user.idFields.length === 1 && user.idField ? user.idField : undefined;
  if (!idField || !["String", "Int", "BigInt"].includes(baseType(idField.type))) {
    errors.push(
      '- User must have one explicit String, Int, or BigInt field marked with "@id".',
    );
  }

  const usernameField = user.fields.find(
    (field) =>
      field.name === "username" &&
      baseType(field.type) === "String" &&
      hasAttribute(field, "unique"),
  );
  const emailField = user.fields.find(
    (field) =>
      field.name === "email" &&
      baseType(field.type) === "String" &&
      hasAttribute(field, "unique"),
  );
  const credentialField = [usernameField, emailField]
    .find(
      (field) =>
        field &&
        baseType(field.type) === "String" &&
        hasAttribute(field, "unique"),
    );
  if (!credentialField) {
    errors.push(
      '- Add a unique String credential field, for example `username String @unique` or `email String @unique`.',
    );
  }

  const passwordField = ["passwordHash", "password"]
    .map((name) => user.fields.find((field) => field.name === name))
    .find((field) => field && baseType(field.type) === "String");
  if (!passwordField) {
    errors.push(
      "- Add `passwordHash String` (preferred) or `password String`; Switchboard stores only a scrypt hash.",
    );
  }

  const roleField = user.fields.find((field) => field.name === "role");
  const roleEnum = roleField ? parsed.enums[baseType(roleField.type)] : undefined;
  if (!roleField || !roleEnum?.includes("ADMIN")) {
    errors.push(
      "- Add a role enum field whose Prisma enum includes the value `ADMIN`.",
    );
  }

  if (errors.length > 0) {
    throw authSchemaError(schemaPath, errors);
  }

  const nameField = user.fields.find(
    (field) => field.name === "name" && baseType(field.type) === "String",
  );
  const supportedCreateFields = new Set([
    idField.name,
    credentialField.name,
    passwordField.name,
    roleField.name,
    nameField?.name,
    usernameField?.name,
    emailField?.name,
  ]);
  const unsupportedRequiredFields = user.fields.filter((field) => {
    const type = baseType(field.type);
    const isRelation = parsed.models.some((model) => model.name === type);
    return (
      !supportedCreateFields.has(field.name) &&
      !field.type.endsWith("?") &&
      !field.type.endsWith("[]") &&
      !hasAttribute(field, "default") &&
      !hasAttribute(field, "updatedAt") &&
      !isRelation
    );
  });

  return {
    modelName: user.name,
    clientProperty: "user",
    idField: idField.name,
    credentialField: credentialField.name,
    usernameField: usernameField?.name,
    emailField: emailField?.name,
    passwordField: passwordField.name,
    roleField: roleField.name,
    nameField: nameField?.name,
    unsupportedRequiredFields: unsupportedRequiredFields.map(
      (field) => field.name,
    ),
  };
}

export async function loadAuthSchema(schemaPath) {
  const schema = await fs.readFile(schemaPath, "utf8");
  return analyzeAuthSchema(
    parsePrismaSchema(schema, schemaPath),
    schemaPath,
  );
}
