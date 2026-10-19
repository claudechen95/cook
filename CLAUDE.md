# Cook — Claude Code Context

Instagram video → recipe converter. Next.js 16 app router, deployed on Vercel.

## Stack
- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`) — `claude-opus-4-8` with adaptive thinking
- **Database:** Upstash Redis (`@upstash/redis`)
- **Deployment:** Vercel (`npm run deploy`)

## Architecture
- `app/page.tsx` — client UI: URL input → video download → frame extraction → recipe display + save
- `app/api/download-video` — POST: picks the video item, streams full mp4 back to browser
- `app/api/video-info` — POST: returns the post's title + caption
- `app/api/extract-recipe` — POST: sends frames to Claude vision, returns recipe JSON
- `app/api/recipes` — GET list / POST save
- `app/api/recipes/[id]` — DELETE
- `lib/ytdlp.ts` — shared yt-dlp invocation: binary resolution, cookies, timeout, metadata probe
- `lib/kv.ts` — Upstash Redis helpers
- `lib/types.ts` — `Recipe`, `Ingredient` interfaces

## Notes
- Local-only (yt-dlp can't run on Vercel serverless)
- **Keep yt-dlp current.** Instagram changes its internals often and a stale yt-dlp
  fails with a misleading "login required / rate-limit reached" error even on public
  posts. `yt-dlp -U` self-updates the standalone binary.
- Avoid Homebrew's yt-dlp here: this Mac runs the Intel (`/usr/local`) Homebrew prefix
  on arm64, so there are no matching bottles and it rebuilds Python from source
  (~30 min) on every upgrade. Use the standalone binary instead:
  ```bash
  curl -L -o ~/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
  chmod +x ~/bin/yt-dlp
  ```
- Instagram posts can be carousels mixing video and photos, so the video is not always
  the first item. Both routes probe metadata first and select the first item that has
  video formats.

## Required env vars (.env.local)
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ANTHROPIC_API_KEY=
```

Optional:
```
YT_DLP_PATH=              # path to yt-dlp if it isn't on the server's PATH
YT_DLP_COOKIES_FILE=      # cookies.txt, for private/age-gated posts
YT_DLP_COOKIES_BROWSER=   # e.g. "chrome:Profile 12" — note bare "chrome" means the
                          # Default profile, which may hold no Instagram session
```

## Dev
```bash
npm run dev     # localhost:3000
npm run deploy  # git push → Vercel
```
