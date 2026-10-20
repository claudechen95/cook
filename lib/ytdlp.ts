import { spawn } from "child_process";

// Resolved from env so the app keeps working when yt-dlp isn't on the server's PATH.
const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";

const TIMEOUT_MS = 120_000;

// Buffer<ArrayBuffer> rather than the wider Buffer<ArrayBufferLike>, so stdout
// stays directly usable as a Response body.
export type YtDlpResult = { code: number | null; stdout: Buffer<ArrayBuffer>; stderr: string };

/**
 * Instagram serves most posts without auth, but private, age-gated and
 * occasionally rate-limited posts need a logged-in session.
 */
export function cookieArgs(): string[] {
  const { YT_DLP_COOKIES_FILE, YT_DLP_COOKIES_BROWSER } = process.env;
  if (YT_DLP_COOKIES_FILE) return ["--cookies", YT_DLP_COOKIES_FILE];
  if (YT_DLP_COOKIES_BROWSER) return ["--cookies-from-browser", YT_DLP_COOKIES_BROWSER];
  return [];
}

export function runYtDlp(args: string[]): Promise<YtDlpResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, args);
    const chunks: Buffer[] = [];
    let stderr = "";

    const timer = setTimeout(() => proc.kill("SIGKILL"), TIMEOUT_MS);

    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(chunks), stderr });
    });
  });
}

/**
 * Metadata for a whole post. `-J` returns a single JSON object, where
 * `--dump-json` emits one object per carousel item; and
 * `--ignore-no-formats-error` stops a carousel's photo children from failing
 * the extraction before we reach the video.
 */
export function probePost(url: string): Promise<YtDlpResult> {
  return runYtDlp([...cookieArgs(), "--ignore-no-formats-error", "-J", "--no-warnings", url]);
}

/**
 * yt-dlp's stderr is written for developers - it cites issue templates and CLI
 * flags. Turn the cases a user can actually hit into something they can act on,
 * and log the original for debugging.
 */
export function friendlyError(stderr: string): string {
  console.error("[yt-dlp]", stderr.trim());

  const s = stderr.toLowerCase();

  if (s.includes("no video formats")) {
    return "That post has no video - it looks like photos only.";
  }
  if (s.includes("empty media response") || s.includes("requested content is not available")) {
    return "Couldn't open that post. It may be private or deleted, or the link may be wrong.";
  }
  if (s.includes("login required") || s.includes("rate-limit") || s.includes("429")) {
    return "Instagram wants a login for this post - it may be private, or this machine may be temporarily rate-limited. Try again in a few minutes.";
  }
  if (s.includes("unsupported url")) {
    return "That doesn't look like a link to an Instagram post.";
  }
  return "Could not read that post. If this keeps happening, Instagram has likely changed - running `yt-dlp -U` usually fixes it.";
}

export function spawnErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const hint = msg.includes("ENOENT")
    ? " - is yt-dlp installed? Set YT_DLP_PATH if it isn't on the PATH."
    : "";
  return `Could not run yt-dlp: ${msg}${hint}`;
}
