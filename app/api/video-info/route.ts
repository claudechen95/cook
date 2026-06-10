import { NextResponse } from "next/server";
import { spawn } from "child_process";

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || !url.includes("instagram.com")) {
    return NextResponse.json({ error: "Invalid Instagram URL" }, { status: 400 });
  }

  return new Promise<Response>((resolve) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn("yt-dlp", ["--dump-json", "--no-download", url]);
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0 || !stdout) {
        resolve(NextResponse.json({ error: `yt-dlp failed: ${stderr.trim()}` }, { status: 422 }));
        return;
      }
      try {
        const meta = JSON.parse(stdout);
        resolve(NextResponse.json({
          title: meta.title ?? "",
          description: meta.description ?? "",
        }));
      } catch {
        resolve(NextResponse.json({ error: "Could not parse metadata" }, { status: 500 }));
      }
    });

    proc.on("error", (err) =>
      resolve(NextResponse.json({ error: err.message }, { status: 500 }))
    );
  });
}
