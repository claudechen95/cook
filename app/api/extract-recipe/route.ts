import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Recipe } from "@/lib/types";

const client = new Anthropic();

export async function POST(request: Request) {
  const { frames, igUrl } = await request.json();

  if (!Array.isArray(frames) || frames.length === 0) {
    return NextResponse.json({ error: "No frames provided" }, { status: 400 });
  }

  const imageBlocks = (frames as string[]).slice(0, 10).map((data) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data,
    },
  }));

  let responseText: string;
  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `These are frames from an Instagram cooking video. Extract the complete recipe.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation:
{
  "title": "Recipe name",
  "ingredients": [
    {"amount": "1", "unit": "cup", "item": "flour"},
    {"item": "salt to taste"}
  ],
  "steps": ["Step 1", "Step 2"],
  "notes": "Optional tips"
}

"amount", "unit", and "notes" are optional fields. Return only the JSON object.`,
            },
          ],
        },
      ],
    });

    const msg = await stream.finalMessage();
    responseText = msg.content.find((b) => b.type === "text")?.text ?? "";
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
  }

  let recipeData: Partial<Recipe>;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    recipeData = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json(
      { error: "Could not parse recipe from AI response" },
      { status: 500 }
    );
  }

  const recipe: Recipe = {
    id: crypto.randomUUID(),
    igUrl: igUrl ?? "",
    savedAt: new Date().toISOString().split("T")[0],
    title: recipeData.title ?? "Untitled Recipe",
    ingredients: recipeData.ingredients ?? [],
    steps: recipeData.steps ?? [],
    notes: recipeData.notes,
  };

  return NextResponse.json({ recipe });
}
