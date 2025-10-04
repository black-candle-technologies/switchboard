// src/app/users/[id]/delete/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.redirect(new URL("/users", request.url), { status: 302 });
}
