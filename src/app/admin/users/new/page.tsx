import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { UserResource } from "@/switchboard/generated/UserResource";
import type { Prisma } from "@prisma/client";

export default function NewUserPage() {
  async function create(formData: FormData) {
    "use server";
    const data: Prisma.UserUncheckedCreateInput = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(
        formData.get("role") ?? "",
      ) as Prisma.UserUncheckedCreateInput["role"],
    };
    await prisma.user.create({ data });
    revalidatePath("/admin/users");
    redirect("/admin/users");
  }

  return (
    <SmartForm
      title="New User"
      fields={UserResource.fields}
      submitLabel="Create"
      cancelHref="/admin/users"
      action={create}
    />
  );
}
