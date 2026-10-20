/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle, so the always-on service runs from its own
  // directory instead of this worktree. See scripts/serve-local.sh.
  output: "standalone",
  turbopack: {
    // A stray package-lock.json in ~/workspace otherwise wins root inference.
    root: import.meta.dirname,
  },
};
export default nextConfig;
