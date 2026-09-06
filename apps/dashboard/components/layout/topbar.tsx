'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  Bell,
  ChevronDown,
  User,
  MessageSquare,
  CheckCheck,
  ArrowRight,
  X,
  Send,
  ExternalLink,
} from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useApi, request } from '@/hooks/use-api';
import { useRealtime } from '@/hooks/use-realtime';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeEventMessage } from '@/lib/realtime';

interface NotificationItem {
  id: string;
  business_id: string;
  type: string;
  title: string;
  description: string;
  preview: string | null;
  lead_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationsResponse {
  total: number;
  unreadCount: number;
  notifications: NotificationItem[];
}

interface FloatingNotification {
  id: string;
  title: string;
  description: string;
  preview: string;
  conversationId?: string;
  createdAt: number;
}

function formatRelativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return s < 10 ? 'agora' : `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [floatingNotif, setFloatingNotif] = useState<FloatingNotification | null>(null);

  // Busca notificações reais com refetch a cada 15 segundos
  const notifQuery = useApi<NotificationsResponse>(
    ['notifications'],
    'notifications',
    { refetchInterval: 15000 }
  );

  // Auto-dismiss do popout flutuante após 8 segundos
  useEffect(() => {
    if (!floatingNotif) return;
    const timer = setTimeout(() => {
      setFloatingNotif(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [floatingNotif]);

  // Invalida dados e exibe popout flutuante quando chega nova resposta de WhatsApp
  const handleRealtimeMessage = useCallback(
    (event: RealtimeEventMessage) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });

      if (event.payload?.direction === 'IN') {
        const notifData = event.payload.notification as
          | { id?: string; title?: string; description?: string; preview?: string }
          | undefined;

        const notifTitle = notifData?.title || 'Nova resposta no WhatsApp';
        const notifDesc = notifData?.description || 'Um contato respondeu sua mensagem.';
        const notifPreview = notifData?.preview || event.payload.content || '';

        setFloatingNotif({
          id: notifData?.id || String(Date.now()),
          title: notifTitle,
          description: notifDesc,
          preview: notifPreview,
          conversationId: event.conversationId,
          createdAt: Date.now(),
        });
      }
    },
    [queryClient]
  );

  useRealtime({
    new_message_received: handleRealtimeMessage,
  });

  const notifications = notifQuery.data?.notifications ?? [];
  const unreadCount = notifQuery.data?.unreadCount ?? 0;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await request('notifications/mark-all-read', {
        method: 'POST',
        body: {},
      });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    setNotifOpen(false);
    if (!notif.read) {
      try {
        await request(`notifications/${notif.id}/read`, {
          method: 'PATCH',
          body: {},
        });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch {
        // ignore
      }
    }

    if (notif.conversation_id) {
      router.push(`/inbox/${notif.conversation_id}`);
    } else {
      router.push('/inbox');
    }
  };

  const handleFloatingClick = () => {
    if (floatingNotif?.conversationId) {
      router.push(`/inbox/${floatingNotif.conversationId}`);
    } else {
      router.push('/inbox');
    }
    setFloatingNotif(null);
  };

  const displayName = user?.email ? user.email.split('@')[0] : 'Maicon Silva';
  const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const displayRole =
    user?.platform_role === 'PLATFORM_ADMIN'
      ? 'Administrador'
      : user?.businessRole === 'OWNER'
      ? 'Proprietário'
      : 'Administrador';

  const initials = formattedName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Popout Flutuante Elegante de Notificação em Tempo Real */}
      {floatingNotif ? (
        <div className="fixed top-5 right-5 z-50 w-full max-w-sm sm:max-w-md animate-in slide-in-from-top-6 fade-in duration-300">
          <div
            onClick={handleFloatingClick}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[rgba(0,153,255,0.35)] bg-[#050914]/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(0,140,255,0.2)] backdrop-blur-xl transition-all hover:border-[#00E5FF] hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
          >
            {/* Barra de progresso de auto-dismiss */}
            <div className="absolute top-0 left-0 h-1 w-full bg-[#080D18]">
              <div className="h-full bg-gradient-to-r from-[#00E5A0] to-[#00E5FF] animate-[progress_8s_linear_forwards] shadow-[0_0_10px_rgba(0,229,255,0.6)]" />
            </div>

            <div className="flex items-start gap-3.5 pt-1">
              {/* Ícone WhatsApp */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00E5A0]/15 border border-[#00E5A0]/30 text-[#00E5A0] shadow-[0_0_12px_rgba(0,229,160,0.3)]">
                <MessageSquare className="h-5 w-5" />
              </div>

              {/* Detalhes da Notificação */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#00E5A0]">
                    <span className="h-2 w-2 rounded-full bg-[#00E5A0] animate-ping" />
                    {floatingNotif.title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFloatingNotif(null);
                    }}
                    className="rounded-lg p-1 text-[#64748B] transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-1 text-sm font-bold text-white">
                  {floatingNotif.description}
                </div>

                {floatingNotif.preview ? (
                  <div className="mt-2 line-clamp-2 rounded-xl border border-[rgba(0,153,255,0.18)] bg-[#080D18] p-2.5 text-xs font-medium text-[#A8B3C7]">
                    "{floatingNotif.preview}"
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between pt-1">
                  <span className="text-[11px] font-medium text-[#64748B]">Recebido agora</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00E5FF] group-hover:translate-x-0.5 transition-transform">
                    Abrir conversa <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[rgba(0,140,255,0.15)] bg-[#020409]/90 px-4 backdrop-blur-xl lg:px-8">
        {/* Barra de Busca Tecnológica HUD */}
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative w-full max-w-md hidden sm:block">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <svg className="h-4 w-4 text-[#00E5FF] drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <input
              type="text"
              readOnly
              placeholder="Inteligência que conecta você aos seus clientes"
              className="w-full rounded-full border border-[#008CFF]/45 bg-[#050914] py-2 pl-10 pr-4 text-xs text-white placeholder-[#A8B3C7] shadow-[0_0_15px_rgba(0,140,255,0.15)] focus:border-[#00E5FF] focus:outline-none focus:shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all cursor-default"
            />
          </div>
          <div className="sm:hidden">
            <h1 className="text-base font-bold text-white tracking-tight">{title}</h1>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Notification bell dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setDropdownOpen(false);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#A8B3C7] border border-[rgba(0,153,255,0.2)] bg-[#050914] transition-all hover:bg-[#008CFF]/10 hover:text-white hover:border-[#008CFF] focus:outline-none"
              aria-label="Notificações"
              aria-expanded={notifOpen}
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00E5FF] px-1 text-[10px] font-black text-[#020409] ring-2 ring-[#020409] shadow-[0_0_10px_rgba(0,229,255,0.6)] animate-in zoom-in-50">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>

            {notifOpen ? (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-12 z-30 w-80 sm:w-96 overflow-hidden rounded-2xl border border-[rgba(0,153,255,0.25)] bg-[#050914] shadow-[0_16px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(0,140,255,0.18)] animate-in fade-in zoom-in-95 duration-150">
                  {/* Header do Popover */}
                  <div className="flex items-center justify-between border-b border-[rgba(0,153,255,0.15)] bg-[#080D18] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Notificações</span>
                      {unreadCount > 0 ? (
                        <span className="rounded-full bg-[#00E5FF]/15 border border-[#00E5FF]/30 px-2 py-0.5 text-[11px] font-bold text-[#00E5FF]">
                          {unreadCount} nova{unreadCount === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </div>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        disabled={markingAll}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#00E5FF] hover:text-white disabled:opacity-50 transition-colors"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Marcar todas
                      </button>
                    ) : null}
                  </div>

                  {/* Lista de Notificações */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-[rgba(0,153,255,0.1)]">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => void handleNotificationClick(notif)}
                          className={`group flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-[#008CFF]/8 ${
                            !notif.read ? 'bg-[#00E5A0]/8' : ''
                          }`}
                        >
                          {/* Ícone */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00E5A0]/15 border border-[#00E5A0]/30 text-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.2)]">
                            <MessageSquare className="h-4 w-4" />
                          </div>

                          {/* Conteúdo */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-xs font-bold text-white">
                                {notif.title}
                              </span>
                              <span className="shrink-0 text-[10px] font-medium text-[#64748B]">
                                {formatRelativeTime(notif.created_at)}
                              </span>
                            </div>
                            <div className="mt-0.5 truncate text-xs font-medium text-[#A8B3C7]">
                              {notif.description}
                            </div>
                            {notif.preview ? (
                              <div className="mt-1 line-clamp-2 rounded-lg bg-[#080D18] border border-[rgba(0,153,255,0.15)] p-1.5 text-[11px] text-[#A8B3C7] italic">
                                "{notif.preview}"
                              </div>
                            ) : null}
                          </div>

                          {/* Indicador não lida */}
                          {!notif.read ? (
                            <div className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-[#00E5FF] shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#080D18] text-[#64748B] mb-2 border border-[rgba(0,153,255,0.15)]">
                          <Bell className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-bold text-white">Nenhuma notificação</div>
                        <div className="text-[11px] text-[#A8B3C7] mt-0.5">
                          Novas respostas de WhatsApp aparecerão aqui em tempo real.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer do Popover */}
                  <div className="border-t border-[rgba(0,153,255,0.15)] bg-[#080D18] p-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        router.push('/inbox');
                      }}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold text-[#A8B3C7] hover:bg-[#008CFF]/10 hover:text-white transition-colors"
                    >
                      <span>Ver todas em Mensagens</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* User profile pill chip */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen((v) => !v);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2.5 rounded-full border border-[#008CFF]/35 bg-[#050914] px-2.5 py-1.5 shadow-[0_0_12px_rgba(0,140,255,0.12)] transition-all hover:border-[#00E5FF] hover:shadow-[0_0_18px_rgba(0,229,255,0.25)]"
              aria-expanded={dropdownOpen}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-[#008CFF] to-[#00E5FF] text-xs font-black text-white shadow-[0_0_8px_rgba(0,229,255,0.4)]">
                {initials}
              </div>
              <div className="hidden text-left sm:block pr-1">
                <div className="text-xs font-bold leading-tight text-white">{formattedName}</div>
                <div className="text-[10px] font-medium leading-tight text-[#A8B3C7]">{displayRole}</div>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-[#64748B] sm:block" />
            </button>

            {dropdownOpen ? (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-2xl border border-[rgba(0,153,255,0.25)] bg-[#050914] p-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(0,140,255,0.15)]">
                  <div className="border-b border-[rgba(0,153,255,0.15)] px-3 py-2 text-xs">
                    <div className="font-bold text-white">{formattedName}</div>
                    <div className="text-[11px] text-[#A8B3C7] truncate">{user?.email ?? 'admin@savyron.com'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      router.push('/settings');
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#A8B3C7] transition-colors hover:bg-[#008CFF]/10 hover:text-white"
                  >
                    <User className="h-3.5 w-3.5 text-[#00E5FF]" />
                    Configurações
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#FF3366] transition-colors hover:bg-[#FF3366]/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sair do sistema
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}
