import { NextResponse } from "next/server";
import { probePost, spawnErrorMessage } from "@/lib/ytdlp";

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || !url.includes("instagram.com")) {
    return NextResponse.json({ error: "Invalid Instagram URL" }, { status: 400 });
  }

  try {
    const probe = await probePost(url);

    if (probe.code !== 0 || probe.stdout.length === 0) {
      return NextResponse.json(
        { error: `Could not read post: ${probe.stderr.trim() || "no output from yt-dlp"}` },
        { status: 422 }
      );
    }

    // Caption lives at the top level for both single posts and carousels.
    const meta = JSON.parse(probe.stdout.toString());

    return NextResponse.json({
      title: meta.title ?? "",
      description: meta.description ?? "",
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Could not parse metadata" }, { status: 500 });
    }
    return NextResponse.json({ error: spawnErrorMessage(err) }, { status: 500 });
  }
}
