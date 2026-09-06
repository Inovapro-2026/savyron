import { ReactNode } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import './dashboard.css';

export const dynamic = 'force-dynamic';

export default async function DashboardGroupLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <>
      {session?.impersonating ? (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-200 backdrop-blur-md shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
          Você está acessando esta empresa como administrador da plataforma
          {session.impersonator ? ` (${session.impersonator})` : ''}.
          <Link href="/admin/impersonate/exit" className="ml-2 font-bold text-amber-400 underline hover:text-white transition-colors">
            Sair do modo de suporte
          </Link>
        </div>
      ) : null}
      {children}
    </>
  );
}