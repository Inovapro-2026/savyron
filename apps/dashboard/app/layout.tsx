import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { ChunkErrorBoundary } from '@/components/chunk-error-boundary';
import { THEME_INIT_SCRIPT } from '@/components/theme/theme-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

const THEME_COLOR = '#ffffff';

export const metadata: Metadata = {
  title: { default: 'SAVYRON', template: '%s · SAVYRON' },
  description: 'Plataforma de prospecção comercial automatizada do SAVYRON',
  robots: { index: false, follow: false },
  applicationName: 'SAVYRON',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SAVYRON',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      {/* Anti-flash: aplica data-theme ANTES da primeira pintura (default = dark). */}
      <Script id="savyron-theme-init" strategy="beforeInteractive">
        {THEME_INIT_SCRIPT}
      </Script>
      <body className="min-h-screen">
        <ChunkErrorBoundary>
          <Providers>{children}</Providers>
        </ChunkErrorBoundary>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
