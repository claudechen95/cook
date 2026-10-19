import { NextResponse } from "next/server";
import { cookieArgs, probePost, runYtDlp, spawnErrorMessage } from "@/lib/ytdlp";

// Pre-merged mp4, sorted to prefer h264/aac so the <video> element can decode it
// in every browser. No post-processor runs, which matters because we stream to stdout.
const FORMAT_ARGS = ["-f", "b[ext=mp4]/b", "-S", "vcodec:h264,acodec:aac"];

function hasVideo(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const formats = (entry as { formats?: { vcodec?: string }[] }).formats ?? [];
  return formats.some((f) => f.vcodec && f.vcodec !== "none");
}

/**
 * Carousel posts come back as a playlist mixing video and photo children, so the
 * video isn't necessarily first. Returns the 1-based playlist index to download,
 * a null index for a plain single-video post, or null when there's no video.
 */
function pickVideoItem(meta: { _type?: string; entries?: unknown[] }): { index: number | null } | null {
  const entries = meta._type === "playlist" ? meta.entries : null;

  if (!entries) return hasVideo(meta) ? { index: null } : null;

  const found = entries.findIndex(hasVideo);
  return found === -1 ? null : { index: found + 1 };
}

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || !url.includes("instagram.com")) {
    return NextResponse.json({ error: "Invalid Instagram URL" }, { status: 400 });
  }

  try {
    // Pass 1: metadata, to find which item in the post actually holds the video.
    const probe = await probePost(url);

    if (probe.code !== 0 || probe.stdout.length === 0) {
      return NextResponse.json(
        { error: `Could not read post: ${probe.stderr.trim() || "no output from yt-dlp"}` },
        { status: 422 }
      );
    }

    const target = pickVideoItem(JSON.parse(probe.stdout.toString()));

    if (!target) {
      return NextResponse.json(
        { error: "That post has no video - it looks like photos only." },
        { status: 422 }
      );
    }

    // Pass 2: stream the chosen item.
    const selection = target.index === null ? ["--no-playlist"] : ["-I", String(target.index)];

    const dl = await runYtDlp([
      ...cookieArgs(),
      ...selection,
      ...FORMAT_ARGS,
      "--no-warnings",
      "--no-progress",
      "-o",
      "-",
      url,
    ]);

    if (dl.code !== 0 || dl.stdout.length === 0) {
      return NextResponse.json(
        { error: `Download failed: ${dl.stderr.trim() || "no output from yt-dlp"}` },
        { status: 422 }
      );
    }

    return new Response(dl.stdout, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(dl.stdout.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: spawnErrorMessage(err) }, { status: 500 });
  }
}
