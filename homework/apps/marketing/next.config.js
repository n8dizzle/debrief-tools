/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@homework/shared'],
  output: 'standalone',
};

module.exports = nextConfig;
