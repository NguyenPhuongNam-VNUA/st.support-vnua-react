'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import BreadcrumbsWrapper from '@/components/BreadcrumbsWrapper';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button
} from '@mui/material';
import NotificationCenter from '@/components/NotificationCenter';
import {
  LayoutGrid,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
  Menu,
  X,
  MessageSquareText,
  Sparkles,
  Sliders,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const menuGroups = [
    {
      title: 'TỔNG QUAN',
      items: [
        {
          label: 'Dashboard',
          href: '/admin/dashboard',
          icon: LayoutGrid,
        },
        {
          label: 'Lịch sử hội thoại',
          href: '/admin/conversations',
          icon: MessageSquareText,
        },
      ],
    },
    {
      title: 'QUẢN LÝ AI AGENT',
      items: [
        {
          label: 'Quản lý câu hỏi',
          href: '/admin/questions',
          icon: HelpCircle,
        },
        {
          label: 'Thư viện tài liệu PDF',
          href: '/admin/documents',
          icon: FileText,
        },
        {
          label: 'Huấn luyện Agent',
          href: '/admin/training',
          icon: Sparkles,
        },
        {
          label: 'Cấu hình Agent',
          href: '/admin/settings',
          icon: Sliders,
        },
      ],
    },
  ];

  const handleConfirmLogout = () => {
    setLogoutConfirmOpen(false);
    logout();
    router.push('/login');
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col font-sans bg-[#f4f7fb] text-slate-900">
        
        {/* TOP HEADER */}
        <header className="h-16 border-b border-[#edf4fc] px-6 flex items-center justify-between sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-xs">
          {/* Left: Direct ST Logo (no frame, z-index 50) + App Title */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileOpen(!mobileOpen)} 
              className="md:hidden p-1.5 rounded-lg text-slate-700 hover:bg-[#edf4fc] transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            <Link href="/admin/dashboard" className="flex items-center gap-3 group">
              <Image 
                src="/st.png" 
                alt="ST Logo" 
                width={42} 
                height={42} 
                className="object-contain relative z-50 hover:scale-105 transition-transform drop-shadow-sm flex-shrink-0"
              />
              <div className="flex flex-col relative z-10">
                <span className="font-extrabold text-base sm:text-lg text-[#2563eb] tracking-tight leading-tight">
                  Hệ thống quản lý <span className="text-red-600">ST - Care</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 leading-tight hidden sm:block">
                  Khoa Công nghệ Thông tin — VNUA
                </span>
              </div>
            </Link>
          </div>

          {/* Right: Admin ST Logo with Container + Logout Button */}
          <div className="flex items-center gap-3 sm:gap-4">
            <NotificationCenter />
            {/* Profile (Admin ST Logo in Container Frame) & Logout */}
            <div className="flex items-center gap-2 sm:gap-3 pl-3 border-l border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="relative z-50">
                  {/* Logo ST Admin inside container frame directly on header */}
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Image src="/st.png" alt="Admin Logo ST" width={26} height={26} className="object-contain" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                </div>
                <div className="hidden lg:flex flex-col">
                  <span className="text-xs font-extrabold text-slate-900 leading-tight">{user?.name || 'Admin Local'}</span>
                  <span className="text-[10px] text-[#2563eb] font-semibold leading-tight">{user?.email || 'nvt500943@gmail.com'}</span>
                </div>
              </div>

              {/* Logout Button with Confirm Dialog */}
              <button
                onClick={() => setLogoutConfirmOpen(true)}
                className="p-1.5 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* BODY: SIDEBAR + MAIN CONTENT AREA */}
        <div className="flex flex-1 relative">
          {/* Mobile Backdrop Overlay */}
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-20 md:hidden transition-opacity"
              onClick={() => setMobileOpen(false)}
            />
          )}

          {/* LEFT SIDEBAR - Auth Branded */}
          <aside className={`
            fixed md:sticky top-16 z-30 h-[calc(100vh-4rem)] w-64 border-r border-[#edf4fc] flex flex-col justify-between transition-all duration-300 flex-shrink-0 bg-white ${
              mobileOpen ? 'left-0 shadow-2xl' : '-left-64 md:left-0'
            }
          `}>
            <div className="p-4 space-y-6 overflow-y-auto flex-1">
              {menuGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <div className="px-3 text-[11px] font-extrabold tracking-wider text-[#2563eb] uppercase">
                    {group.title}
                  </div>
                  <nav className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`
                            group relative flex items-center justify-between px-3.5 py-2.5 rounded-none text-xs sm:text-sm font-bold transition-all ${
                              isActive
                                ? 'bg-[#2563eb] text-white shadow-md shadow-[#2563eb]/25'
                                : 'text-slate-700 hover:text-[#2563eb]'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <Icon size={18} className={isActive ? 'text-white' : 'text-slate-900'} />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <ChevronRight size={14} className="text-red-400" />}
                          {!isActive && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-4/5 h-[2.5px] bg-red-600 transition-all duration-300 ease-out" />
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-[#edf4fc] text-[11px] text-slate-500 text-center font-bold">
              <span className="text-[#2563eb]">ST-Support VNUA</span> — Khoa CNTT
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto w-full max-w-full overflow-x-hidden">
            <BreadcrumbsWrapper />
            <div className="mt-2">
              {children}
            </div>
          </main>
        </div>

        {/* APPLE macOS / iOS SOFT ORGANIC LOGOUT MODAL */}
        <Dialog
          open={logoutConfirmOpen}
          onClose={() => setLogoutConfirmOpen(false)}
          slotProps={{
            backdrop: {
              sx: {
                backgroundColor: 'rgba(15, 23, 42, 0.3)',
                backdropFilter: 'blur(10px)',
              }
            }
          }}
          PaperProps={{
            sx: {
              borderRadius: '28px',
              p: 3.5,
              maxWidth: 380,
              width: '92%',
              mx: 'auto',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(24px) saturate(180%)',
              boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              textAlign: 'center',
            }
          }}
        >
          <div className="flex flex-col items-center">
            {/* Logout Icon Direct */}
            <div className="mb-3.5 transition-transform hover:scale-105">
              <Image src="/logout.png" alt="Logout Icon" width={64} height={64} className="object-contain" />
            </div>

            <DialogTitle sx={{ p: 0, mb: 1, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontSize: '1.2rem' }}>
              Xác nhận đăng xuất
            </DialogTitle>

            <DialogContent sx={{ p: 0, mb: 3.5 }}>
              <DialogContentText sx={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn rời khỏi phiên làm việc của <span className="font-extrabold text-slate-900">ST - Care</span> không?
              </DialogContentText>
            </DialogContent>

            <DialogActions sx={{ p: 0, width: '100%', display: 'flex', gap: 1.5 }}>
              <Button 
                onClick={() => setLogoutConfirmOpen(false)} 
                fullWidth
                variant="text"
                disableElevation
                sx={{ 
                  borderRadius: '14px', 
                  py: 1.2,
                  textTransform: 'none', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  '&:hover': { backgroundColor: '#e2e8f0', color: '#1e293b' },
                  transition: 'all 0.2s ease'
                }}
              >
                Hủy bỏ
              </Button>
              <Button 
                onClick={handleConfirmLogout} 
                fullWidth
                variant="contained" 
                disableElevation
                sx={{ 
                  borderRadius: '14px', 
                  py: 1.2,
                  textTransform: 'none', 
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  boxShadow: '0 8px 16px -4px rgba(239, 68, 68, 0.35)',
                  '&:hover': { backgroundColor: '#dc2626', boxShadow: '0 10px 20px -4px rgba(220, 38, 38, 0.4)' },
                  transition: 'all 0.2s ease'
                }}
              >
                Đăng xuất
              </Button>
            </DialogActions>
          </div>
        </Dialog>

      </div>
    </ProtectedRoute>
  );
}
