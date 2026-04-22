/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bundle recharts through Next's compiler to resolve its transitive peer-dep
  // on react-is. Without this, Turbopack in Next 16 fails with
  // "Module not found: Can't resolve 'react-is'" at build time on Vercel.
  transpilePackages: ['recharts'],
}

module.exports = nextConfig
