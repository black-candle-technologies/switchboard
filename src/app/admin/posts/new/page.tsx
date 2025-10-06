import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SmartForm } from "@/components/form/SmartForm";
import { PostResource } from "@/switchboard/generated/PostResource";
import type { Prisma, PostStatus } from "@prisma/client";

function str(v: FormDataEntryValue | null, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export default function NewPostPage() {
  async function create(formData: FormData) {
    "use server";

    const title = str(formData.get("title"));
    const content = str(formData.get("content")) || undefined;
    const statusStr = (str(formData.get("status")) || "DRAFT") as PostStatus;
    const authorId = str(formData.get("authorId"));

    if (!title) throw new Error("Title is required.");
    if (!authorId) throw new Error("authorId is required.");

    // Use Unchecked input to set the FK directly (no nested author object)
    const data: Prisma.PostUncheckedCreateInput = {
      title,
      content,
      status: statusStr,
      authorId, // required FK
    };

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
