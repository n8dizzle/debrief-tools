/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Parts Board moved /board → /parts (route name now matches /warehouse).
      // Edge-level redirect so old bookmarks/links don't 404. A server-component
      // redirect in app/board/page.tsx does NOT work here: AppShell is imported
      // with ssr:false, so page children never render on the server and the
      // redirect never fires. This runs before React, so it's immune to that.
      { source: '/board', destination: '/parts', permanent: true },
    ];
  },
}

module.exports = nextConfig
