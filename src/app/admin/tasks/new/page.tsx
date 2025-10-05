import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { TaskResource } from "@/switchboard/generated/TaskResource";

export default function NewTaskPage() {
  async function create(formData: FormData) {
    "use server";
    const data = Object.fromEntries(formData.entries());
    await prisma.task.create({ data });
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
