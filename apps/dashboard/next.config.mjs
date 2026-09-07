/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=()' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/lead-import',
        destination: '/prospect?tab=import',
        permanent: false,
      },
      // Fase F: rotas órfãs da configuração antiga redirecionam para a tela
      // unificada "Empresa + IA" (substitui Meu negócio + Configurar IA).
      {
        source: '/ai/settings',
        destination: '/settings/empresa-ia',
        permanent: true,
      },
      {
        source: '/settings/business',
        destination: '/settings/empresa-ia',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
