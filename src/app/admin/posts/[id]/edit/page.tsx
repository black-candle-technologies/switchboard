import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { PostResource } from "@/switchboard/generated/PostResource";

export default async function EditPostPage({
  params,
}: {
  params: { id: string };
}) {
  const existing = await prisma.post.findUnique({
    where: { id: params.id },
  });
  if (!existing) return <p className="text-sm text-gray-500">Not found.</p>;

  async function update(formData: FormData) {
    "use server";
    const data = Object.fromEntries(formData.entries());
    await prisma.post.update({
      where: { id: params.id },
      data,
    });
    redirect("/admin/posts");
  }

  return (
    // find the SmartForm and change this prop:
    <SmartForm
      title="Edit Post"
      fields={PostResource.fields}
      initialValues={existing as Record<string, unknown>}   // was: as any
      submitLabel="Save"
      cancelHref="/admin/posts"
      action={update}
    />
  );
}
