"use client";

import { useState, useEffect } from "react";
import type { Recipe, Ingredient } from "@/lib/types";

// ── API helpers ───────────────────────────────────────────────────────────────

async function getVideoInfo(igUrl: string): Promise<{ title: string; description: string }> {
  const res = await fetch("/api/video-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: igUrl }),
  });
  if (!res.ok) return { title: "", description: "" };
  return res.json();
}

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
  return URL.createObjectURL(await res.blob());
}

async function extractFrames(videoSrc: string, count = 8): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const frames: string[] = [];
    let idx = 0;

    const seekNext = () => {
      video.currentTime = video.duration * (0.05 + (idx / Math.max(count - 1, 1)) * 0.9);
    };
    video.addEventListener("error", () => reject(new Error("Video failed to load.")));
    video.addEventListener("loadedmetadata", () => {
      if (!video.duration || !isFinite(video.duration))
        return reject(new Error("Could not determine video duration."));
      canvas.width = Math.min(video.videoWidth, 720);
      canvas.height = Math.round((canvas.width * video.videoHeight) / video.videoWidth);
      seekNext();
    });
    video.addEventListener("seeked", () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.75).split(",")[1]);
      idx++;
      if (idx >= count) resolve(frames);
      else seekNext();
    });
    video.src = videoSrc;
  });
}

// ── Recipe display components ─────────────────────────────────────────────────

function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <ul className="divide-y divide-gray-100">
      {ingredients.map((ing, i) => (
        <li key={i} className="flex items-baseline justify-between py-2.5 gap-3">
          <span className="text-sm">{ing.item}</span>
          {(ing.amount || ing.unit) && (
            <span className="text-sm text-gray-400 shrink-0">
              {[ing.amount, ing.unit].filter(Boolean).join(" ")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function StepList({ steps, stepFrames }: { steps: string[]; stepFrames?: string[] }) {
  return (
    <ol className="space-y-6">
      {steps.map((step, i) => {
        const frame = stepFrames?.[i];
        return (
          <li key={i}>
            {frame && (
              <img
                src={`data:image/jpeg;base64,${frame}`}
                alt={`Step ${i + 1}`}
                className="w-full rounded-xl object-cover mb-3 aspect-video"
              />
            )}
            <div className="flex gap-3">
              <span className="text-xs font-bold text-gray-400 mt-0.5 shrink-0 w-5 text-right">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">{step}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RecipeView({
  recipe,
  onBack,
  actionSlot,
}: {
  recipe: Recipe;
  onBack?: () => void;
  actionSlot?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"ingredients" | "steps">("ingredients");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        {onBack && (
          <button onClick={onBack} className="text-sm text-gray-400 mb-2 flex items-center gap-1">
            ← Back
          </button>
        )}
        <h2 className="text-lg font-bold leading-snug">{recipe.title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {recipe.ingredients.length} ingredients · {recipe.steps.length} steps · {recipe.savedAt}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(["ingredients", "steps"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "text-black border-b-2 border-black" : "text-gray-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "ingredients" ? (
          <IngredientList ingredients={recipe.ingredients} />
        ) : (
          <StepList steps={recipe.steps} stepFrames={recipe.stepFrames} />
        )}
        {recipe.notes && (
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
            <span className="font-medium">Notes: </span>
            {recipe.notes}
          </div>
        )}
      </div>

      {/* Action slot (save button or view-original link) */}
      {actionSlot && <div className="px-4 pb-6 pt-2 border-t border-gray-100">{actionSlot}</div>}
    </div>
  );
}

// ── Extract screen ────────────────────────────────────────────────────────────

type Phase = "idle" | "fetching" | "extracting" | "analyzing" | "done" | "error";

const PHASE_MESSAGES: Record<Phase, string> = {
  idle: "",
  fetching: "Fetching caption & downloading…",
  extracting: "Extracting frames…",
  analyzing: "Analyzing with Claude…",
  done: "",
  error: "",
};

function ExtractScreen() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [saved, setSaved] = useState(false);

  const busy = phase === "fetching" || phase === "extracting" || phase === "analyzing";

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    setPhase("fetching");
    setErrorMsg("");
    setRecipe(null);
    setSaved(false);

    try {
      const [info, blobUrl] = await Promise.all([getVideoInfo(url), downloadVideo(url)]);
      setPhase("extracting");
      const frames = await extractFrames(blobUrl);
      URL.revokeObjectURL(blobUrl);

      setPhase("analyzing");
      const res = await fetch("/api/extract-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, caption: info.description, igUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to extract recipe");

      setRecipe(data.recipe);
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
    if (res.ok) setSaved(true);
  }

  if (recipe) {
    return (
      <RecipeView
        recipe={recipe}
        onBack={() => { setRecipe(null); setPhase("idle"); }}
        actionSlot={
          saved ? (
            <p className="text-center text-sm text-green-600 font-medium py-2">Saved to your recipes</p>
          ) : (
            <button
              onClick={handleSave}
              className="w-full bg-black text-white py-3 rounded-xl text-sm font-semibold"
            >
              Save recipe
            </button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Cook</h1>
        <p className="text-gray-500 text-sm mt-1">Turn any Instagram cooking video into a recipe.</p>
      </div>

      <form onSubmit={handleExtract} className="w-full space-y-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/..."
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          disabled={busy}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-black text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {busy ? PHASE_MESSAGES[phase] : "Extract Recipe"}
        </button>
      </form>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
          {PHASE_MESSAGES[phase]}
        </div>
      )}

      {phase === "error" && (
        <div className="w-full text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

// ── Saved Recipes screen ──────────────────────────────────────────────────────

function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Recipe | null>(null);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then((d) => setRecipes(d.recipes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    if (viewing?.id === id) setViewing(null);
  }

  if (viewing) {
    return (
      <RecipeView
        recipe={viewing}
        onBack={() => setViewing(null)}
        actionSlot={
          <div className="flex items-center justify-between">
            <a
              href={viewing.igUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 underline underline-offset-2"
            >
              View original
            </a>
            <button
              onClick={() => handleDelete(viewing.id)}
              className="text-sm text-red-500"
            >
              Delete
            </button>
          </div>
        }
      />
    );
  }

  if (loading) {
    return (
      <div className="overflow-y-auto h-full">
        <div className="px-4 pt-5 pb-2">
          <div className="h-7 w-32 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <ul className="divide-y divide-gray-100 px-4">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-2">
        <p className="text-gray-400 text-sm">No saved recipes yet.</p>
        <p className="text-gray-300 text-xs">Extract one and tap Save.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="px-4 pt-5 pb-2">
        <h2 className="text-xl font-bold">My Recipes</h2>
      </div>
      <ul className="divide-y divide-gray-100 px-4">
        {recipes.map((r) => {
          const thumb = r.stepFrames?.[0];
          return (
            <li key={r.id}>
              <button
                onClick={() => setViewing(r)}
                className="w-full flex items-center gap-3 py-3 text-left"
              >
                {thumb ? (
                  <img
                    src={`data:image/jpeg;base64,${thumb}`}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.ingredients.length} ingredients · {r.steps.length} steps · {r.savedAt}
                  </p>
                </div>
                <span className="text-gray-300 shrink-0">›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

type Tab = "extract" | "recipes";

export default function Home() {
  const [tab, setTab] = useState<Tab>("extract");

  return (
    <div className="flex flex-col h-[100dvh] max-w-lg mx-auto">
      {/* Screen */}
      <div className="flex-1 overflow-hidden">
        {tab === "extract" ? <ExtractScreen /> : <RecipesScreen />}
      </div>

      {/* Bottom nav */}
      <nav className="flex border-t border-gray-200 bg-white shrink-0">
        {(["extract", "recipes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors ${
              tab === t ? "text-black" : "text-gray-400"
            }`}
          >
            <span className="text-lg leading-none">{t === "extract" ? "✦" : "≡"}</span>
            <span className="capitalize">{t === "extract" ? "Extract" : "Recipes"}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
