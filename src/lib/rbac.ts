export type RoleName = "ADMIN" | "MANAGER" | "USER";

export type UserContext = {
  id: string;
  role: RoleName;
  orgId?: string | null;
};

export const Policy = {
  users: {
    canList: () => true,
    canCreate: (ctx: UserContext) => ctx.role === "ADMIN" || ctx.role === "MANAGER",
    canUpdate: (ctx: UserContext) => ctx.role === "ADMIN" || ctx.role === "MANAGER",
    canDelete: (ctx: UserContext) => ctx.role === "ADMIN",
  },
};
