import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { TaskResource } from "@/switchboard/generated/TaskResource";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export default async function EditTaskPage({
  params,
}: {
  params: { id: string };
}) {
  const existing = await prisma.task.findUnique({
    where: { id: params.id },
  });
  if (!existing) return <p className="text-sm text-gray-500">Not found.</p>;

  async function update(formData: FormData) {
    "use server";

    const title = String(formData.get("title") ?? "");

    const projectIdRaw = formData.get("projectId");
    const project =
      projectIdRaw == null || String(projectIdRaw) === ""
        ? undefined
        : { connect: { id: String(projectIdRaw) } };

    const data: Prisma.TaskUpdateInput = {
      title,
      project, // relation
    };

    await prisma.task.update({ where: { id: params.id }, data });
    revalidatePath("/admin/tasks");
    redirect("/admin/tasks");
  }

  return (
    <SmartForm
      title="Edit Task"
      fields={TaskResource.fields}
      initialValues={existing as Record<string, unknown>}   // was: as any
      submitLabel="Save"
      cancelHref="/admin/tasks"
      action={update}
    />
  );
}
