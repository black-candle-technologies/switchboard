import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { UserResource } from "@/switchboard/generated/UserResource";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";

export default async function EditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const existing = await prisma.user.findUnique({
    where: { id: params.id },
  });
  if (!existing) return <p className="text-sm text-gray-500">Not found.</p>;

  async function update(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const roleRaw = formData.get("role");
    const role =
      roleRaw == null || String(roleRaw) === "" ? undefined : (String(roleRaw) as Role);

    const data: Prisma.UserUpdateInput = { name, email, role };

    await prisma.user.update({ where: { id: params.id }, data });
    revalidatePath("/admin/users");
    redirect("/admin/users");
  }

  return (
    <SmartForm
      title="Edit User"
      fields={UserResource.fields}
      initialValues={existing as Record<string, unknown>}
      submitLabel="Save"
      cancelHref="/admin/users"
      action={update}
    />
  );
}
