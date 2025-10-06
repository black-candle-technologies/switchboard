import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { TaskResource } from "@/switchboard/generated/TaskResource";

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
    const data = Object.fromEntries(formData.entries());
    await prisma.task.update({
      where: { id: params.id },
      data,
    });
    redirect("/admin/tasks");
  }

  return (
    <SmartForm
      title="Edit Task"
      fields={TaskResource.fields}
      initialValues={existing as any}
      submitLabel="Save"
      cancelHref="/admin/tasks"
      action={update}
    />
  );
}
