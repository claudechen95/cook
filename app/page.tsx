"use client";

import { useState, useEffect } from "react";
import type { Recipe } from "@/lib/types";

async function downloadVideo(igUrl: string): Promise<string> {
  const res = await fetch("/api/download-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: igUrl }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to download video");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function extractFrames(videoSrc: string, count = 8): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const frames: string[] = [];
    let frameIdx = 0;

    const seekNext = () => {
      const pct = frameIdx / Math.max(count - 1, 1);
      video.currentTime = video.duration * (0.05 + pct * 0.9);
    };

    video.addEventListener("error", () =>
      reject(new Error("Video failed to load. The proxy may have been blocked."))
    );

    video.addEventListener("loadedmetadata", () => {
      if (!video.duration || !isFinite(video.duration)) {
        reject(new Error("Could not determine video duration."));
        return;
      }
      canvas.width = Math.min(video.videoWidth, 640);
      canvas.height = Math.round((canvas.width * video.videoHeight) / video.videoWidth);
      seekNext();
    });

    video.addEventListener("seeked", () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
      frameIdx++;
      if (frameIdx >= count) {
        resolve(frames);
      } else {
        seekNext();
      }
    });

    video.src = videoSrc;
  });
}

type Phase = "idle" | "fetching" | "extracting" | "analyzing" | "done" | "error";

const PHASE_MESSAGES: Record<Phase, string> = {
  idle: "",
  fetching: "",
  extracting: "Downloading & extracting frames...",
  analyzing: "Analyzing recipe with Claude...",
  done: "",
  error: "",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [saved, setSaved] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then((d) => setRecipes(d.recipes ?? []))
      .catch(() => {});
  }, []);

  const busy = phase === "fetching" || phase === "extracting" || phase === "analyzing";

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    setPhase("fetching");
    setErrorMsg("");
    setRecipe(null);
    setSaved(false);

    try {
      setPhase("extracting");
      const blobUrl = await downloadVideo(url);
      const frames = await extractFrames(blobUrl);
      URL.revokeObjectURL(blobUrl);

      setPhase("analyzing");
      const recipeRes = await fetch("/api/extract-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, igUrl: url }),
      });
      const recipeData = await recipeRes.json();
      if (!recipeRes.ok) throw new Error(recipeData.error ?? "Failed to extract recipe");

      setRecipe(recipeData.recipe);
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleSave() {
    if (!recipe) return;
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe }),
    });
    if (res.ok) {
      setSaved(true);
      setRecipes((prev) => [recipe, ...prev]);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IG Recipe Extractor</h1>
        <p className="text-gray-500 text-sm mt-1">
          Paste a public Instagram cooking video URL to extract the recipe.
        </p>
      </div>

      <form onSubmit={handleExtract} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/..."
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          disabled={busy}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-40 shrink-0"
        >
          {busy ? "Working..." : "Extract"}
        </button>
      </form>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-black rounded-full animate-spin" />
          {PHASE_MESSAGES[phase]}
        </div>
      )}

      {phase === "error" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {errorMsg}
        </div>
      )}

      {recipe && (
        <div className="border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex justify-between items-start gap-4">
            <h2 className="text-xl font-bold">{recipe.title}</h2>
            {saved ? (
              <span className="text-xs text-green-600 font-medium shrink-0 pt-1">Saved</span>
            ) : (
              <button
                onClick={handleSave}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-md font-medium shrink-0"
              >
                Save recipe
              </button>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Ingredients
            </h3>
            <ul className="space-y-1.5 text-sm">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-gray-400 w-24 shrink-0 text-right">
                    {[ing.amount, ing.unit].filter(Boolean).join(" ") || "—"}
                  </span>
                  <span>{ing.item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Instructions
            </h3>
            <ol className="space-y-2 text-sm">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-gray-400 font-medium shrink-0 w-5 text-right">
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {recipe.notes && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
              <span className="font-medium">Notes: </span>
              {recipe.notes}
            </div>
          )}

          <div className="text-xs text-gray-400 border-t pt-3">
            <a
              href={recipe.igUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              View original
            </a>
          </div>
        </div>
      )}

      {recipes.length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-3">Saved Recipes</h2>
          <div className="space-y-2">
            {recipes.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between border border-gray-200 rounded-lg px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {r.ingredients.length} ingredients &middot; {r.steps.length} steps &middot;{" "}
                    {r.savedAt}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-xs text-gray-400 hover:text-red-500 ml-4 shrink-0 pt-0.5"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
