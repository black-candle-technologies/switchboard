import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { ProjectResource } from "@/switchboard/generated/ProjectResource";

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
    const data = Object.fromEntries(formData.entries());
    await prisma.project.update({
      where: { id: params.id },
      data,
    });
    redirect("/admin/projects");
  }

  return (
    <SmartForm
      title="Edit Project"
      fields={ProjectResource.fields}
      initialValues={existing as any}
      submitLabel="Save"
      cancelHref="/admin/projects"
      action={update}
    />
  );
}
