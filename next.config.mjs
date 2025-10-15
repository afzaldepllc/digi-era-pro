/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongoose', 'rate-limiter-flexible'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  webpack: (config, { isServer }) => {
    // Exclude rate-limiter-flexible from client-side bundling
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push('rate-limiter-flexible');
      
      // Add fallback for server-only packages
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'rate-limiter-flexible': false,
      };
    }
    
    // Handle .d.ts files - exclude them from webpack processing
    config.module.rules.push({
      test: /\.d\.ts$/,
      use: 'ignore-loader'
    });
    
    // Exclude TypeScript definition files from rate-limiter-flexible
    config.module.rules.push({
      test: /node_modules\/rate-limiter-flexible\/.*\.d\.ts$/,
      use: 'ignore-loader'
    });
    
    return config;
  }
}

export default nextConfig
