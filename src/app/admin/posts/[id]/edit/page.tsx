import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { PostResource } from "@/switchboard/generated/PostResource";
import { revalidatePath } from "next/cache";
import type { Prisma, Post } from "@prisma/client";
import { PostStatus } from "@prisma/client";

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

    const title = String(formData.get("title") ?? "");
    const contentRaw = formData.get("content");
    const content =
      contentRaw == null || String(contentRaw).trim() === "" ? null : String(contentRaw);

    const statusRaw = formData.get("status");
    const status =
      statusRaw == null || String(statusRaw) === ""
        ? undefined
        : (String(statusRaw) as PostStatus);

    const authorIdRaw = formData.get("authorId");
    const author =
      authorIdRaw == null || String(authorIdRaw) === ""
        ? undefined
        : { connect: { id: String(authorIdRaw) } };

    const data: Prisma.PostUpdateInput = {
      title,
      content,
      status,
      author, // relation must be nested
    };

    await prisma.post.update({
      where: { id: params.id },
      data,
    });

    revalidatePath("/admin/posts");
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
