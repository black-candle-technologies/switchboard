import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { TaskResource } from "@/switchboard/generated/TaskResource";
import type { Prisma } from "@prisma/client";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditTaskPage({ params }: PageProps) {
  const routeParams = await params;
  const id = routeParams.id;
  const existing = await prisma.task.findUnique({
    where: { id: id },
  });
  if (!existing)
    return <div className="sb-card sb-empty-state">Record not found.</div>;

  async function update(formData: FormData) {
    "use server";
    const data: Prisma.TaskUncheckedUpdateInput = {
      projectId: String(formData.get("projectId") ?? ""),
      title: String(formData.get("title") ?? ""),
      dueDate: formData.get("dueDate")
        ? new Date(String(formData.get("dueDate") ?? ""))
        : null,
      done: formData.has("done"),
      assigneeId: formData.get("assigneeId")
        ? String(formData.get("assigneeId") ?? "")
        : null,
    };
    await prisma.task.update({
      where: { id: id },
      data,
    });
    revalidatePath("/admin/tasks");
    redirect("/admin/tasks");
  }

  const initialValues = Object.fromEntries(
    Object.entries(existing).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString().slice(0, 16) : value,
    ]),
  );

  return (
    <SmartForm
      title="Edit Task"
      fields={TaskResource.fields}
      initialValues={initialValues}
      submitLabel="Save"
      cancelHref="/admin/tasks"
      action={update}
    />
  );
}
