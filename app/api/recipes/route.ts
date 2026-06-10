import { NextResponse } from "next/server";
import { getRecipes, saveRecipe } from "@/lib/kv";

export async function GET() {
  try {
    const recipes = await getRecipes();
    return NextResponse.json({ recipes });
  } catch {
    return NextResponse.json({ recipes: [] });
  }
}

export async function POST(request: Request) {
  const { recipe } = await request.json();
  try {
    await saveRecipe(recipe);
    return NextResponse.json({ recipe });
  } catch (err) {
    console.error("Save recipe error:", err);
    return NextResponse.json({ error: "Failed to save recipe" }, { status: 500 });
  }
}
