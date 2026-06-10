import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Recipe } from "@/lib/types";

const client = new Anthropic();

export async function POST(request: Request) {
  const { frames, caption, igUrl } = await request.json();

  if (!caption && (!Array.isArray(frames) || frames.length === 0)) {
    return NextResponse.json({ error: "No caption or frames provided" }, { status: 400 });
  }

  const frameCount = Array.isArray(frames) ? (frames as string[]).length : 0;

  // Build content: interleave labeled frames then the text prompt
  const content: Anthropic.MessageParam["content"] = [];

  if (frameCount > 0) {
    (frames as string[]).slice(0, 10).forEach((data, i) => {
      content.push({ type: "text", text: `Frame ${i}:` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    });
  }

  const captionSection = caption
    ? `\n\nVIDEO CAPTION (use this as your primary source for the recipe):\n${caption}\n`
    : "";

  const frameInstruction = frameCount > 0
    ? `\n"stepFrameIndices": an array with one entry per step — the index (0–${frameCount - 1}) of the frame that best illustrates that step visually.`
    : "";

  content.push({
    type: "text",
    text: `${captionSection}
Extract the complete recipe from the above.${frameCount > 0 ? " The frames are from the same video — use them to assign visuals to each step." : ""}

Return ONLY a valid JSON object — no markdown, no code fences, no explanation:
{
  "title": "Recipe name",
  "ingredients": [
    {"amount": "1", "unit": "cup", "item": "flour"},
    {"item": "salt to taste"}
  ],
  "steps": ["Step 1 description", "Step 2 description"],${frameCount > 0 ? `
  "stepFrameIndices": [0, 2, 4, 5, 6, 7],` : ""}
  "notes": "Optional tips"
}
${frameInstruction}
"amount", "unit", and "notes" are optional. Return only the JSON object.`,
  });

  let responseText: string;
  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content }],
    });
    const msg = await stream.finalMessage();
    responseText = msg.content.find((b) => b.type === "text")?.text ?? "";
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
  }

  let recipeData: Partial<Recipe> & { stepFrameIndices?: number[] };
  try {
    const jsonMatch = responseText.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    recipeData = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Could not parse recipe from AI response" }, { status: 500 });
  }

  const steps = recipeData.steps ?? [];
  const indices = recipeData.stepFrameIndices ?? [];
  const stepFrames =
    frameCount > 0
      ? steps.map((_, i) => {
          const idx =
            indices[i] ?? Math.round((i / Math.max(steps.length - 1, 1)) * (frameCount - 1));
          return (frames as string[])[Math.min(idx, frameCount - 1)];
        })
      : undefined;

  const recipe: Recipe = {
    id: crypto.randomUUID(),
    igUrl: igUrl ?? "",
    savedAt: new Date().toISOString().split("T")[0],
    title: recipeData.title ?? "Untitled Recipe",
    ingredients: recipeData.ingredients ?? [],
    steps,
    stepFrames,
    notes: recipeData.notes,
  };

  return NextResponse.json({ recipe });
}
