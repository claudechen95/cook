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

## Always-on local service

The app can't run on Vercel - there's no yt-dlp binary in a serverless runtime,
and Instagram treats datacenter IPs very differently from a home connection. It
runs instead as a launchd service on this Mac:

**http://claudes-macbook-air.local:3100**

Use the Bonjour name, not the LAN IP - the DHCP lease is 2 hours, so the address
changes. The app is installable to the iOS home screen (Share → Add to Home
Screen); it has a web manifest and declares itself standalone, so it opens
full-screen without browser chrome.

```bash
./scripts/serve-local.sh   # build, publish to ~/srv/cook, restart the service
```

| | |
|---|---|
| Service | `com.cook.server` (`scripts/com.cook.server.plist`) |
| Runs from | `~/srv/cook` — a standalone build, **not** this worktree |
| Logs | `~/Library/Logs/cook/` |
| Stop | `launchctl bootout gui/$(id -u)/com.cook.server` |
| Start | `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.cook.server.plist` |

Why it runs from `~/srv/cook` rather than this directory:

- Editing code or switching branches can't disturb the running app.
- The repo's dev-server git guard blocks `checkout`/`pull`/`rebase` while a server
  watches *that worktree*. Running outside it keeps git usable here. (Next renames
  its process to `next-server` either way, so only the working directory saves us.)

Port 3100 rather than 3000 keeps `npm run dev` free for development.

Changes only go live after `./scripts/serve-local.sh` — the service serves a built
copy, so editing files here changes nothing until you publish.

The plist pins nvm's versioned node path; update it after an nvm upgrade or the
service won't start.
