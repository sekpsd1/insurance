/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb'
    }
  },
  ...(isProduction ? { output: 'standalone' } : {})
};

module.exports = nextConfig;
