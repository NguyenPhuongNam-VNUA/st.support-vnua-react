'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog, Tooltip } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { LogOut, Search, Settings, ShieldCheck } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import BreadcrumbsWrapper from '@/components/BreadcrumbsWrapper';
import NotificationCenter from '@/components/NotificationCenter';
import { useAuth } from '@/contexts/AuthContext';
import kravioTheme from '@/components/admin/kravioTheme';
import {
  ModDashboardIcon,
  HistoryListIcon,
  BubbleQuestionIcon,
  Library2Icon,
  TrainingLoopIcon,
  ConfigurationPlaybook1Icon,
} from '@/components/icons/SidebarIcons';

const menuGroups = [
  {
    title: 'Tổng quan hệ thống',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: ModDashboardIcon },
      { label: 'Lịch sử hội thoại', href: '/admin/conversations', icon: HistoryListIcon },
    ],
  },
  {
    title: 'Quản trị tri thức AI',
    items: [
      { label: 'Quản lý câu hỏi', href: '/admin/questions', icon: BubbleQuestionIcon },
      { label: 'Thư viện tài liệu RAG', href: '/admin/documents', icon: Library2Icon },
      { label: 'Huấn luyện Agent', href: '/admin/training', icon: TrainingLoopIcon },
      { label: 'Cấu hình AI Agent', href: '/admin/settings', icon: ConfigurationPlaybook1Icon },
    ],
  },
  {
    title: 'Quản trị hệ thống',
    items: [{ label: 'Quản lý tài khoản', href: '/admin/accounts', icon: ShieldCheck }],
  },
];

const hoverShadow =
  'hover:shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]';

function SidebarToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.334 8c0-2.46 0-3.689.543-4.56a3 3 0 0 1 .736-.83C3.388 2 4.48 2 6.667 2h2.667c2.186 0 3.279 0 4.054.61.287.226.536.506.737.83.542.871.542 2.1.542 4.56s0 3.689-.542 4.56a3 3 0 0 1-.737.83C12.613 14 11.52 14 9.334 14H6.667c-2.186 0-3.279 0-4.054-.61a3 3 0 0 1-.736-.83C1.334 11.689 1.334 10.46 1.334 8Z"
        stroke="#9CA3AF"
        strokeWidth="1.2"
      />
      <path d="M9.665 2v12" stroke="#9CA3AF" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function getInitials(name?: string | null) {
  const words = (name || 'Admin VNUA').trim().split(/\s+/);
  return ((words[0]?.[0] || '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Skin lives on <body> so MUI portals (dialogs, menus, popovers) inherit it.
  useEffect(() => {
    document.body.classList.add('kravio');
    return () => document.body.classList.remove('kravio');
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const handleConfirmLogout = async () => {
    setLogoutConfirmOpen(false);
    await logout();
    router.replace('/login');
  };

  const q = query.trim().toLowerCase();
  const groups = menuGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q)) }))
    .filter((g) => g.items.length > 0);

  const sidebar = (
    <aside className="flex h-full w-[250px] shrink-0 flex-col" aria-label="Primary">
      <div className="flex w-[250px] items-center justify-between overflow-clip px-3 py-3.5">
        <Link
          href="/admin/dashboard"
          className="flex w-[200px] items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40"
        >
          <Image
            src="/st.png"
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 object-contain transition-transform duration-300 hover:rotate-[-8deg] hover:scale-105"
          />
          <span className="flex-1 text-lg font-semibold leading-none text-[#1f2937]">ST - Care</span>
        </Link>
        <Tooltip title="Thu gọn thanh bên">
          <button
            type="button"
            aria-label="Thu gọn thanh bên"
            onClick={() => (mobileOpen ? setMobileOpen(false) : setCollapsed(true))}
            className="-m-1 rounded-md p-1 outline-none transition-colors hover:bg-black/[0.05] focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40"
          >
            <SidebarToggleIcon />
          </button>
        </Tooltip>
      </div>

      <div className="flex min-h-0 w-[250px] flex-1 flex-col gap-4 px-3 pb-4">
        <div className="h-0 w-full shrink-0 border-t border-dashed border-black/10" />

        <label className="group/input flex h-8 w-full shrink-0 cursor-text items-center gap-2 overflow-clip rounded-lg border-[0.8px] border-[#e5e7eb] bg-white py-2 pl-2.5 pr-2 shadow-[0px_4px_14px_0px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[#d1d5db] focus-within:border-[#9ca3af] focus-within:shadow-[0_0_0_3px_rgba(156,163,175,0.18)]">
          <Search size={16} strokeWidth={1.4} className="shrink-0 text-[#4b5563]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm chức năng"
            aria-label="Tìm kiếm chức năng"
            className="min-w-0 flex-1 bg-transparent text-[13px] leading-none text-[#1f2937] outline-none placeholder:text-[#6b7280] [&::-webkit-search-cancel-button]:hidden"
          />
        </label>

        <nav className="k-no-scrollbar flex min-h-0 w-[226px] flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden">
          {groups.map((group) => (
            <div key={group.title} className="flex w-full flex-col gap-3">
              <p className="whitespace-nowrap text-xs uppercase leading-[1.6] text-[#6b7280]">{group.title}</p>
              <div className="flex w-full flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group/nav flex h-8 w-full items-center gap-2.5 rounded-lg border-[0.8px] px-2.5 text-[13px] leading-none outline-none transition-[background-color,box-shadow,border-color,color] duration-150 focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40 ${
                        isActive
                          ? 'border-[#e5e7eb] bg-white text-[#1f2937] shadow-[0px_4px_7px_0px_rgba(0,0,0,0.04)]'
                          : 'border-transparent text-[#4b5563] hover:bg-white/70 hover:text-[#1f2937]'
                      }`}
                    >
                      <span className="flex transition-transform duration-200 ease-out group-hover/nav:scale-110">
                        <Icon size={16} strokeWidth={1.5} className="text-[#4b5563]" />
                      </span>
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <Tooltip title="Đăng xuất" placement="top">
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className={`group/acct flex w-[226px] shrink-0 items-center gap-2 rounded-xl border-[0.8px] border-[#e5e7eb] bg-white py-2 pl-2 pr-2.5 text-left outline-none drop-shadow-[0px_0px_4px_rgba(0,0,0,0.03)] transition-[box-shadow,transform] duration-200 active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40 ${hoverShadow}`}
          >
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border-[0.8px] border-[#d9d9d9] bg-[#f7f7f7] p-2">
              <span className="whitespace-nowrap text-xs font-semibold leading-none tracking-[-0.12px] text-[#4b5563]">
                {getInitials(user?.full_name)}
              </span>
              <span className="absolute bottom-[-1.7px] right-[-1.7px] size-[9px]">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#059669]/40 [animation-duration:2.4s]" />
                <span className="absolute inset-0 rounded-full border-[1.5px] border-white bg-[#059669]" />
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 whitespace-nowrap leading-none">
              <span className="truncate text-sm font-medium text-[#1f2937]">{user?.full_name || 'Admin VNUA'}</span>
              <span className="truncate text-xs text-[#9ca3af]">{user?.email || 'admin@vnua.edu.vn'}</span>
            </span>
            <span className="flex text-[#9ca3af] transition-transform duration-200 group-hover/acct:scale-110 group-hover/acct:text-[#ef4444]">
              <LogOut size={16} strokeWidth={1.5} />
            </span>
          </button>
        </Tooltip>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute>
      <ThemeProvider theme={kravioTheme}>
        <div className="flex min-h-dvh w-full bg-[#f8f8f8] text-[#1f2937]">
          {/* Desktop sidebar (collapsible) */}
          <div
            className={`sticky top-0 hidden h-dvh shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(.16,1,.3,1)] lg:block ${
              collapsed ? 'w-0' : 'w-[250px]'
            }`}
          >
            <div className={`h-full transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>{sidebar}</div>
          </div>

          {/* Mobile drawer */}
          <div className={`fixed inset-0 z-40 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`} aria-hidden={!mobileOpen}>
            <div
              className={`absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => setMobileOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Điều hướng"
              className={`absolute inset-y-0 left-0 h-dvh bg-[#f8f8f8] shadow-[0_12.5px_10px_rgba(0,0,0,0.06),0_41.8px_33.4px_rgba(0,0,0,0.086),0_100px_80px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${
                mobileOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              {sidebar}
            </div>
          </div>

          <main className="flex min-w-0 flex-1 flex-col bg-white px-3 shadow-[inset_0_0_0_0.8px_#e5e7eb] lg:min-h-dvh">
            <header className="flex h-[52px] w-full items-center justify-between px-3 py-3.5">
              <div className="flex min-w-0 items-center gap-4">
                <button
                  type="button"
                  aria-label="Mở thanh bên"
                  onClick={() => (collapsed ? setCollapsed(false) : setMobileOpen(true))}
                  className={`-my-1 -ml-1 rounded-md p-1 outline-none transition-colors hover:bg-black/[0.05] focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40 ${
                    collapsed ? '' : 'lg:hidden'
                  }`}
                >
                  <SidebarToggleIcon />
                </button>
                <BreadcrumbsWrapper />
              </div>
              <div className="flex items-center gap-3">
                <NotificationCenter />
                <Tooltip title="Cấu hình AI Agent">
                  <Link
                    href="/admin/settings"
                    aria-label="Cấu hình"
                    className="-m-1 inline-flex size-6 items-center justify-center rounded-md p-1 text-[#4b5563] outline-none transition-[background-color,transform] duration-150 hover:bg-black/[0.04] active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40"
                  >
                    <Settings size={16} strokeWidth={1.5} />
                  </Link>
                </Tooltip>
              </div>
            </header>

            <div className="flex w-full min-w-0 flex-col px-1 py-4">{children}</div>
          </main>

          {/* Logout confirm */}
          <Dialog
            open={logoutConfirmOpen}
            onClose={() => setLogoutConfirmOpen(false)}
            PaperProps={{ sx: { width: '92%', maxWidth: 360, m: 'auto', p: 0.5, bgcolor: '#f6f6f6' } }}
          >
            <div className="flex items-center justify-between p-2">
              <h2 className="text-sm font-medium leading-none text-[#4b5563]">Xác nhận đăng xuất</h2>
            </div>
            <div className="flex flex-col gap-4 rounded-[10px] border-[0.8px] border-[#e5e7eb] bg-white p-4">
              <p className="text-[13px] leading-[1.5] text-[#6b7280]">
                Bạn có chắc chắn muốn rời khỏi phiên làm việc quản trị <span className="font-medium text-[#1f2937]">ST - Care</span> không?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLogoutConfirmOpen(false)}
                  className={`inline-flex h-8 items-center rounded-lg border-[0.8px] border-[#e5e7eb] bg-white px-3 text-xs font-medium text-[#4b5563] transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#fcfcfc] active:scale-[0.97] ${hoverShadow}`}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border-[0.8px] border-[#ef4444] bg-[#ef4444] px-3 text-xs font-medium text-white transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97]"
                >
                  <LogOut size={14} />
                  Đăng xuất
                </button>
              </div>
            </div>
          </Dialog>
        </div>
      </ThemeProvider>
    </ProtectedRoute>
  );
}
