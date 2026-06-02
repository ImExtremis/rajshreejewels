/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Cache optimised Next.js images for 24 hours locally in the browser
    minimumCacheTTL: 86400,
    localPatterns: [
      {
        pathname: '/images/**',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'rajshreejewels.com',
      },
      {
        protocol: 'https',
        hostname: 'api.rajshreejewels.com',
      },
      {
        protocol: 'https',
        hostname: '*.rajshreejewels.com',
      },
    ],
  },
};

export default nextConfig;
