import { Redis } from "@upstash/redis";
import type { Recipe } from "./types";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  cache: "no-store",
});

export async function saveRecipe(recipe: Recipe): Promise<void> {
  await kv.set(`recipe:${recipe.id}`, recipe);
  await kv.lpush("recipes", recipe.id);
}

export async function getRecipes(): Promise<Recipe[]> {
  const ids = await kv.lrange<string>("recipes", 0, -1);
  if (!ids.length) return [];
  const recipes = await Promise.all(ids.map((id) => kv.get<Recipe>(`recipe:${id}`)));
  return recipes.filter((r): r is Recipe => r !== null);
}

export async function deleteRecipe(id: string): Promise<void> {
  await kv.del(`recipe:${id}`);
  await kv.lrem("recipes", 0, id);
}
