import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { ProjectResource } from "@/switchboard/generated/ProjectResource";

export default function NewProjectPage() {
  async function create(formData: FormData) {
    "use server";
    const data = Object.fromEntries(formData.entries());
    await prisma.project.create({ data });
    redirect("/admin/projects");
  }

  return (
    <SmartForm
      title="New Project"
      fields={ProjectResource.fields}
      submitLabel="Create"
      cancelHref="/admin/projects"
      action={create}
    />
  );
}
