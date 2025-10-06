import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { ProjectResource } from "@/switchboard/generated/ProjectResource";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export default async function EditProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const existing = await prisma.project.findUnique({
    where: { id: params.id },
  });
  if (!existing) return <p className="text-sm text-gray-500">Not found.</p>;

  async function update(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "");
    const descRaw = formData.get("description");
    const description =
      descRaw == null || String(descRaw).trim() === "" ? null : String(descRaw);

    const data: Prisma.ProjectUpdateInput = {
      name,
      description,
    };

    await prisma.project.update({ where: { id: params.id }, data });
    revalidatePath("/admin/projects");
    redirect("/admin/projects");
  }

  return (
    <SmartForm
      title="Edit Project"
      fields={ProjectResource.fields}
      initialValues={existing as Record<string, unknown>}   // was: as any
      submitLabel="Save"
      cancelHref="/admin/projects"
      action={update}
    />
  );
}
