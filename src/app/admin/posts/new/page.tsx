import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { PostResource } from "@/switchboard/generated/PostResource";

export default function NewPostPage() {
  async function create(formData: FormData) {
    "use server";
    const data = Object.fromEntries(formData.entries());
    await prisma.post.create({ data });
    redirect("/admin/posts");
  }

  return (
    <SmartForm
      title="New Post"
      fields={PostResource.fields}
      submitLabel="Create"
      cancelHref="/admin/posts"
      action={create}
    />
  );
}
