import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { UserResource } from "@/switchboard/generated/UserResource";

export default function NewUserPage() {
  async function create(formData: FormData) {
    "use server";
    const data = Object.fromEntries(formData.entries());
    await prisma.user.create({ data });
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
