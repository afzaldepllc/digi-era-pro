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
    formats: ['image/webp', 'image/avif'],
  },
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  
  // Performance optimizations for ultra-fast navigation
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Enable modern JavaScript features for better performance
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Enable faster client-side navigation
    clientRouterFilter: true,
    // Enable aggressive code splitting
    optimisticClientCache: true,
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  webpack: (config, { isServer, dev }) => {
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

    // Aggressive performance optimizations
    if (!dev) {
      // Split chunks for better caching and instant navigation
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          maxAsyncRequests: 25,
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            // Separate common UI components
            ui: {
              test: /[\\/]components[\\/]ui[\\/]/,
              priority: 10,
              reuseExistingChunk: true,
            },
            // Separate layout components
            layout: {
              test: /[\\/]components[\\/]layout[\\/]/,
              priority: 9,
              reuseExistingChunk: true,
            },
          },
        },
        // Enable module concatenation for faster execution
        concatenateModules: true,
        // Minimize bundle size
        minimize: true,
      }
    }
    
    // Development optimizations for faster rebuilds
    if (dev) {
      // Disable source maps for faster compilation
      config.devtool = false
      
      config.optimization = {
        ...config.optimization,
        // Faster incremental builds
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      }
    }
    
    return config;
  }
}

export default nextConfig