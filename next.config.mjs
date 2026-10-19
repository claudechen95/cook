/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // A stray package-lock.json in ~/workspace otherwise wins root inference.
    root: import.meta.dirname,
  },
};
export default nextConfig;
