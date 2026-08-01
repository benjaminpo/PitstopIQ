/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep native / Node DB drivers out of the Turbopack client graph.
  serverExternalPackages: ["better-sqlite3", "pg"],
};

export default nextConfig;
