import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { ProjectResource } from "@/switchboard/generated/ProjectResource";
import type { Prisma } from "@prisma/client";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: PageProps) {
  const routeParams = await params;
  const id = routeParams.id;
  const existing = await prisma.project.findUnique({
    where: { id: id },
  });
  if (!existing) return <p className="text-sm text-gray-500">Not found.</p>;

  async function update(formData: FormData) {
    "use server";
    const data: Prisma.ProjectUncheckedUpdateInput = {
      name: String(formData.get("name") ?? ""),
      description: formData.get("description")
        ? String(formData.get("description") ?? "")
        : null,
      status: String(
        formData.get("status") ?? "",
      ) as Prisma.ProjectUncheckedUpdateInput["status"],
      ownerId: formData.get("ownerId")
        ? String(formData.get("ownerId") ?? "")
        : null,
    };
    await prisma.project.update({
      where: { id: id },
      data,
    });
    revalidatePath("/admin/projects");
    redirect("/admin/projects");
  }

  const initialValues = Object.fromEntries(
    Object.entries(existing).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString().slice(0, 16) : value,
    ]),
  );

  return (
    <SmartForm
      title="Edit Project"
      fields={ProjectResource.fields}
      initialValues={initialValues}
      submitLabel="Save"
      cancelHref="/admin/projects"
      action={update}
    />
  );
}
