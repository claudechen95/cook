# Cook — Claude Code Context

Instagram video → recipe converter. Next.js 16 app router, deployed on Vercel.

## Stack
- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`) — `claude-opus-4-8` with adaptive thinking
- **Database:** Upstash Redis (`@upstash/redis`)
- **Deployment:** Vercel (`npm run deploy`)

## Architecture
- `app/page.tsx` — client UI: URL input → frame extraction → recipe display + save
- `app/api/fetch-video` — POST: scrapes Instagram embed page for direct video CDN URL
- `app/api/proxy-video` — GET: streams Instagram CDN video to browser (CORS workaround)
- `app/api/extract-recipe` — POST: sends frames to Claude vision, returns recipe JSON
- `app/api/recipes` — GET list / POST save
- `app/api/recipes/[id]` — DELETE
- `lib/kv.ts` — Upstash Redis helpers
- `lib/types.ts` — `Recipe`, `Ingredient` interfaces

## Required env vars (.env.local)
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ANTHROPIC_API_KEY=
```

## Dev
```bash
npm run dev     # localhost:3000
npm run deploy  # git push → Vercel
```
