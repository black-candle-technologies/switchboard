import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { UserResource } from "@/switchboard/generated/UserResource";

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
    const data = Object.fromEntries(formData.entries());
    await prisma.user.update({
      where: { id: params.id },
      data,
    });
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
