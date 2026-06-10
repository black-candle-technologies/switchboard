import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { TaskResource } from "@/switchboard/generated/TaskResource";
import type { Prisma } from "@prisma/client";

export default function NewTaskPage() {
  async function create(formData: FormData) {
    "use server";
    const data: Prisma.TaskUncheckedCreateInput = {
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
    await prisma.task.create({ data });
    revalidatePath("/admin/tasks");
    redirect("/admin/tasks");
  }

  return (
    <SmartForm
      title="New Task"
      fields={TaskResource.fields}
      submitLabel="Create"
      cancelHref="/admin/tasks"
      action={create}
    />
  );
}
