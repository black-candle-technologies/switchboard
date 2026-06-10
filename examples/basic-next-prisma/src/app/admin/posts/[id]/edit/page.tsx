import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { PostResource } from "@/switchboard/generated/PostResource";
import type { Prisma } from "@prisma/client";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: PageProps) {
  const routeParams = await params;
  const id = routeParams.id;
  const existing = await prisma.post.findUnique({
    where: { id: id },
  });
  if (!existing)
    return <div className="sb-card sb-empty-state">Record not found.</div>;

  async function update(formData: FormData) {
    "use server";
    const data: Prisma.PostUncheckedUpdateInput = {
      title: String(formData.get("title") ?? ""),
      content: formData.get("content")
        ? String(formData.get("content") ?? "")
        : null,
      status: formData.get("status")
        ? (String(
            formData.get("status") ?? "",
          ) as Prisma.PostUncheckedUpdateInput["status"])
        : undefined,
      authorId: String(formData.get("authorId") ?? ""),
    };
    await prisma.post.update({
      where: { id: id },
      data,
    });
    revalidatePath("/admin/posts");
    redirect("/admin/posts");
  }

  const initialValues = Object.fromEntries(
    Object.entries(existing).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString().slice(0, 16) : value,
    ]),
  );

  return (
    <SmartForm
      title="Edit Post"
      fields={PostResource.fields}
      initialValues={initialValues}
      submitLabel="Save"
      cancelHref="/admin/posts"
      action={update}
    />
  );
}
