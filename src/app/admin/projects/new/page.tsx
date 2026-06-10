import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { ProjectResource } from "@/switchboard/generated/ProjectResource";
import type { Prisma } from "@prisma/client";

export default function NewProjectPage() {
  async function create(formData: FormData) {
    "use server";
    const data: Prisma.ProjectUncheckedCreateInput = {
      name: String(formData.get("name") ?? ""),
      description: formData.get("description")
        ? String(formData.get("description") ?? "")
        : null,
      status: formData.get("status")
        ? (String(
            formData.get("status") ?? "",
          ) as Prisma.ProjectUncheckedCreateInput["status"])
        : undefined,
      ownerId: formData.get("ownerId")
        ? String(formData.get("ownerId") ?? "")
        : null,
    };
    await prisma.project.create({ data });
    revalidatePath("/admin/projects");
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
