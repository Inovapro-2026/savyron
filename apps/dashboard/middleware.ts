import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const getSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: SESSION_SECRET must be configured');
  }
  return new TextEncoder().encode(secret || 'dev-secret');
};
const SESSION_COOKIE = 'acp_token';

// Rotas estritamente públicas (não exigem autenticação)
const PUBLIC_AUTH_PATHS = ['/login', '/signup'];
const PUBLIC_PATHS = ['/login', '/signup', '/vitrine'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons/') ||
    pathname.includes('.');

  // Assets estáticos não passam por verificação de autenticação
  if (isAsset) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let session: { must_change_password?: boolean; platform_role?: string; sub?: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (payload && payload.sub) {
        session = {
          sub: String(payload.sub),
          must_change_password: Boolean(payload.must_change_password),
          platform_role: (payload.platform_role as string) || undefined,
        };
      }
    } catch {
      session = null;
    }
  }

  // Raiz -> dashboard se autenticado, login se não autenticado
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = session ? '/dashboard' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Se não possui sessão válida e NÃO é rota pública -> REDIRECIONA PARA LOGIN
  if (!session) {
    if (isPublic) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Possui sessão válida mas tenta acessar tela de login/signup -> redireciona para dashboard
  if (isPublicAuth) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Se for outra rota pública (/vitrine) com sessão válida, permite acesso normal
  if (isPublic) {
    return NextResponse.next();
  }

  const isChangePassword = pathname === '/change-password';

  // Precisa trocar a senha -> força a tela de troca
  if (session.must_change_password && !isChangePassword) {
    const url = req.nextUrl.clone();
    url.pathname = '/change-password';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Senha já trocada, acessando /change-password -> dashboard
  if (!session.must_change_password && isChangePassword) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Rota /admin: exige papel de plataforma (defesa em profundidade; o layout
  // server-side também valida). Sem papel -> /dashboard, sem montar conteúdo.
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
  if (isAdminPath) {
    const role = session.platform_role;
    if (role !== 'PLATFORM_ADMIN' && role !== 'PLATFORM_STAFF') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
