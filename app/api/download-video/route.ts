import { NextResponse } from "next/server";
import { spawn } from "child_process";

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || !url.includes("instagram.com")) {
    return NextResponse.json({ error: "Invalid Instagram URL" }, { status: 400 });
  }

  return new Promise<Response>((resolve) => {
    const chunks: Buffer[] = [];
    let stderr = "";

    const proc = spawn("yt-dlp", [
      "--no-playlist",
      "-f", "mp4",          // prefer mp4 container
      "-o", "-",            // output to stdout
      "--quiet",
      url,
    ]);

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0 || chunks.length === 0) {
        resolve(
          NextResponse.json(
            { error: `yt-dlp failed: ${stderr.trim() || "no output"}` },
            { status: 422 }
          )
        );
        return;
      }

      const videoBuffer = Buffer.concat(chunks);
      resolve(
        new Response(videoBuffer, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(videoBuffer.length),
            "Cache-Control": "private, max-age=300",
          },
        })
      );
    });

    proc.on("error", (err) => {
      resolve(
        NextResponse.json({ error: `Could not run yt-dlp: ${err.message}` }, { status: 500 })
      );
    });
  });
}
