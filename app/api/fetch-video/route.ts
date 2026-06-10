import { NextResponse } from "next/server";

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/\\u002F/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/\\"/g, '"');
}

export async function POST(request: Request) {
  const body = await request.json();
  const url: string = body.url ?? "";

  const shortcode = extractShortcode(url);
  if (!shortcode) {
    return NextResponse.json({ error: "Invalid Instagram URL" }, { status: 400 });
  }

  const fetchHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const embedRes = await fetch(
      `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
      { headers: fetchHeaders }
    );
    const html = await embedRes.text();

    let videoUrl: string | null = null;

    // Pattern 1: JSON "video_url" key
    const m1 = html.match(/"video_url"\s*:\s*"([^"]+)"/);
    if (m1) videoUrl = decodeHtmlEntities(m1[1]);

    // Pattern 2: <video src="...">
    if (!videoUrl) {
      const m2 = html.match(/<video[^>]+src="([^"]+)"/);
      if (m2) videoUrl = m2[1];
    }

    // Pattern 3: data-video-url attribute
    if (!videoUrl) {
      const m3 = html.match(/data-video-url="([^"]+)"/);
      if (m3) videoUrl = m3[1];
    }

    // Pattern 4: CDN mp4 URL in any script block
    if (!videoUrl) {
      const m4 = html.match(/https:\\?\/\\?\/[^"']+\.mp4[^"']*/);
      if (m4) videoUrl = decodeHtmlEntities(m4[0]);
    }

    if (videoUrl) {
      return NextResponse.json({ videoUrl, shortcode });
    }
  } catch (err) {
    console.error("Instagram fetch error:", err);
  }

  return NextResponse.json(
    {
      error:
        "Could not extract video URL. Instagram may have blocked the request, or this post is not a public video.",
    },
    { status: 422 }
  );
}
