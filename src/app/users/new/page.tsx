// src/app/users/new/page.tsx
import { prisma } from "@/lib/prisma";
import { UserInput } from "@/lib/validation";
import { redirect } from "next/navigation";

export default function NewUserPage() {
  async function createUser(formData: FormData) {
    "use server";
    const raw = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "USER"),
    };

    const parsed = UserInput.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(form)"}: ${i.message}`)
        .join("; ");
      throw new Error(msg);
    }

    await prisma.user.create({ data: parsed.data });
    redirect("/users");
  }

  return (
    <section className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">New User</h1>
      <form action={createUser} className="space-y-3 rounded border bg-white p-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input name="name" className="mt-1 w-full rounded border px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" name="email" className="mt-1 w-full rounded border px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Role</label>
          <select name="role" className="mt-1 w-full rounded border px-3 py-2" defaultValue="USER">
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="USER">USER</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Create
          </button>
          <a href="/users" className="rounded border px-3 py-2 text-sm">Cancel</a>
        </div>
      </form>
    </section>
  );
}
