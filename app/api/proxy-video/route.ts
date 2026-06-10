export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("url");

  if (!videoUrl) {
    return new Response("Missing url", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(decodeURIComponent(videoUrl), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Referer: "https://www.instagram.com/",
      },
    });
  } catch {
    return new Response("Failed to fetch video", { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "video/mp4",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
