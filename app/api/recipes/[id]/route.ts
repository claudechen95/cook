import { NextResponse } from "next/server";
import { deleteRecipe } from "@/lib/kv";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await deleteRecipe(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete recipe error:", err);
    return NextResponse.json({ error: "Failed to delete recipe" }, { status: 500 });
  }
}
