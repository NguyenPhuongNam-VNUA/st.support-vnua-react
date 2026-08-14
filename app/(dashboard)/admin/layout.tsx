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
  LogOut,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import {
  ModDashboardIcon,
  HistoryListIcon,
  BubbleQuestionIcon,
  Library2Icon,
  TrainingLoopIcon,
  ConfigurationPlaybook1Icon,
  PersonFireLogoutIcon,
} from '@/components/icons/SidebarIcons';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const menuGroups = [
    {
      title: 'TỔNG QUAN HỆ THỐNG',
      items: [
        {
          label: 'Dashboard Điều Hành',
          href: '/admin/dashboard',
          icon: ModDashboardIcon,
        },
        {
          label: 'Lịch sử hội thoại',
          href: '/admin/conversations',
          icon: HistoryListIcon,
        },
      ],
    },
    {
      title: 'QUẢN TRỊ TRI THỨC AI',
      items: [
        {
          label: 'Quản lý câu hỏi',
          href: '/admin/questions',
          icon: BubbleQuestionIcon,
        },
        {
          label: 'Thư viện tài liệu RAG',
          href: '/admin/documents',
          icon: Library2Icon,
        },
        {
          label: 'Huấn luyện Agent',
          href: '/admin/training',
          icon: TrainingLoopIcon,
        },
        {
          label: 'Cấu hình AI Agent',
          href: '/admin/settings',
          icon: ConfigurationPlaybook1Icon,
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
      <div className="min-h-screen flex flex-col font-sans bg-[#f6f8f7] text-slate-900">
        
        {/* TOP HEADER */}
        <header className="h-16 border-b border-[rgba(13,138,79,0.08)] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-40 bg-white/90 backdrop-blur-xl shadow-xs transition-all">
          {/* Left: Mobile Menu Button + Desktop Elevated Pill Box for ST-Care Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setMobileOpen(!mobileOpen)} 
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-[#f0f8f4] hover:text-[#0d8a4f] transition-colors"
              aria-label="Toggle menu"
            >
              <Menu size={22} />
            </button>
            
            {/* Desktop Brand Pill: Ẩn trên mobile (hidden md:flex), chỉ hiện trên desktop */}
            <Link 
              href="/admin/dashboard" 
              className="hidden md:flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-1.5 rounded-full bg-white border border-[rgba(13,138,79,0.1)] shadow-[0_3px_14px_-2px_rgba(13,138,79,0.08),0_0_0_1px_rgba(255,255,255,0.95)_inset] hover:shadow-[0_6px_20px_-2px_rgba(13,138,79,0.16)] hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="relative flex-shrink-0">
                <Image 
                  src="/st.png" 
                  alt="ST-Care Logo" 
                  width={34} 
                  height={34} 
                  className="object-contain relative z-20 group-hover:scale-105 transition-transform drop-shadow-2xs"
                />
              </div>
              <div className="flex flex-col pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base sm:text-lg text-[#0d8a4f] tracking-tight leading-tight flex items-center">
                    ST <span className="text-[#10b981]">- Care</span>
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-[#f0f8f4] text-[#0d8a4f] border border-[rgba(16,185,129,0.25)]">
                    ADMIN PANEL
                  </span>
                </div>
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-500 leading-tight">
                  Khoa Công nghệ Thông tin — Học viện Nông nghiệp Việt Nam
                </span>
              </div>
            </Link>
          </div>

          {/* Right: Notification Center + Elevated Pill Box for Admin Profile & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationCenter />
            
            {/* Bo tròn 2 đầu cho Profile & Logout với hiệu ứng nổi */}
            <div className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full bg-white border border-[rgba(13,138,79,0.1)] shadow-[0_3px_14px_-2px_rgba(13,138,79,0.08),0_0_0_1px_rgba(255,255,255,0.95)_inset] hover:shadow-[0_6px_20px_-2px_rgba(13,138,79,0.14)] transition-all">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-[#f0f8f4] border border-[#a7f3d0]/80 shadow-2xs p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Image src="/st.png" alt="Admin Logo ST" width={22} height={22} className="object-contain" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                </div>
                <div className="hidden lg:flex flex-col pr-1">
                  <span className="text-xs font-extrabold text-slate-900 leading-tight">{user?.name || 'Admin VNUA'}</span>
                  <span className="text-[10px] text-[#0d8a4f] font-semibold leading-tight">{user?.email || 'admin@vnua.edu.vn'}</span>
                </div>
              </div>

              <div className="h-4 w-[1px] bg-[rgba(13,138,79,0.12)] mx-0.5" />

              {/* Logout Button with Confirm Dialog */}
              <button
                onClick={() => setLogoutConfirmOpen(true)}
                className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* BODY: SIDEBAR + MAIN CONTENT AREA */}
        <div className="flex flex-1 relative">
          {/* Mobile Backdrop Overlay */}
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
              onClick={() => setMobileOpen(false)}
            />
          )}

          {/* LEFT SIDEBAR - Banner-Design & Apple Squircle Aesthetics */}
          <aside className={`
            fixed md:sticky top-0 md:top-16 z-50 md:z-30 h-full md:h-[calc(100vh-4rem)] w-72 md:w-68 border-r border-[rgba(13,138,79,0.08)] flex flex-col justify-between transition-all duration-300 flex-shrink-0 bg-white/98 md:bg-white/95 backdrop-blur-2xl ${
              mobileOpen ? 'left-0 shadow-2xl' : '-left-72 md:left-0'
            }
          `}>
            {/* Mobile Sidebar Brand Header: Hiện thông tin Logo trong Sidebar trên Mobile */}
            <div className="md:hidden p-4 border-b border-[rgba(13,138,79,0.08)] bg-gradient-to-r from-[#f0f8f4] to-white flex items-center justify-between">
              <Link 
                href="/admin/dashboard" 
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <Image 
                  src="/st.png" 
                  alt="ST-Care Logo" 
                  width={34} 
                  height={34} 
                  className="object-contain drop-shadow-2xs flex-shrink-0"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-base text-[#0d8a4f] tracking-tight leading-tight">
                      ST <span className="text-[#10b981]">- Care</span>
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-white text-[#0d8a4f] border border-[rgba(16,185,129,0.25)] shadow-2xs">
                      ADMIN PANEL
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 leading-tight">
                    Khoa CNTT — VNUA
                  </span>
                </div>
              </Link>

              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Đóng menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 space-y-6 overflow-y-auto flex-1">
              {menuGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <div className="px-3 py-1 text-[11px] font-black tracking-wider text-[#0d8a4f] uppercase opacity-90 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                    {group.title}
                  </div>
                  <nav className="space-y-1.5">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`
                            group relative flex items-center justify-between px-3 py-2.5 rounded-[16px] text-xs sm:text-sm font-extrabold transition-all duration-200 overflow-hidden ${
                              isActive
                                ? 'bg-[#eef8f2] text-[#0d8a4f] border border-[#34d399]/70 shadow-[0_2px_10px_-2px_rgba(13,138,79,0.12),0_0_0_1px_rgba(255,255,255,0.8)_inset]'
                                : 'text-slate-700 bg-transparent hover:text-[#0d8a4f] hover:bg-[#f0f8f4]/60 border border-transparent hover:border-[#10b981]/20'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3 min-w-0 z-10">
                            {/* Icon Placed Directly */}
                            <Icon
                              size={21}
                              className={`flex-shrink-0 transition-all duration-200 ${
                                isActive
                                  ? 'text-[#0d8a4f] scale-105'
                                  : 'text-slate-500 group-hover:text-[#0d8a4f] group-hover:scale-110'
                              }`}
                            />
                            <span className="truncate tracking-tight font-extrabold">{item.label}</span>
                          </div>
                          
                          {/* Right Green Dot Indicator for Active Item */}
                          {isActive ? (
                            <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)] ml-1 z-10" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity ml-1 z-10" />
                          )}

                          {/* 1px Underline Expanding from Center to Both Sides on Hover */}
                          <span className={`
                            absolute bottom-0.5 left-4 right-4 h-[1.5px] rounded-full transition-transform duration-300 origin-center pointer-events-none ${
                              isActive
                                ? 'bg-gradient-to-r from-transparent via-[#10b981]/80 to-transparent scale-x-100'
                                : 'bg-gradient-to-r from-transparent via-[#10b981] to-transparent scale-x-0 group-hover:scale-x-100'
                            }
                          `} />
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* Sidebar Footer - Elevated Apple Pill Capsule */}
            <div className="p-3.5 border-t border-[rgba(13,138,79,0.08)] bg-[#fafdfb]">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-[rgba(13,138,79,0.08)] shadow-[0_2px_8px_-2px_rgba(13,138,79,0.06),0_0_0_1px_rgba(255,255,255,0.95)_inset]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#f0f8f4] border border-[#a7f3d0]/60 flex items-center justify-center text-[#0d8a4f]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#0d8a4f]">VNUA IT Dept</span>
                </div>
                <span className="text-[10px] text-[#0d8a4f] font-black bg-[#f0f8f4] px-2 py-0.5 rounded-full border border-[rgba(16,185,129,0.25)]">
                  v2.5 Pro
                </span>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto w-full max-w-full overflow-x-hidden bg-[#f6f8f7]">
            <BreadcrumbsWrapper />
            <div className="mt-1">
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
                backgroundColor: 'rgba(15, 23, 42, 0.35)',
                backdropFilter: 'blur(10px)',
              }
            }
          }}
          PaperProps={{
            sx: {
              borderRadius: '24px',
              p: 3.5,
              maxWidth: 380,
              width: '92%',
              mx: 'auto',
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(24px) saturate(180%)',
              boxShadow: '0 30px 60px -15px rgba(13, 138, 79, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
              border: '1px solid rgba(13, 138, 79, 0.15)',
              textAlign: 'center',
            }
          }}
        >
          <div className="flex flex-col items-center">
            {/* Custom SVG Icon Placed Directly without Div Wrapper */}
            <PersonFireLogoutIcon size={46} className="text-[#0d8a4f] mb-3 transition-transform hover:scale-105" />

            <DialogTitle sx={{ p: 0, mb: 1, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontSize: '1.2rem' }}>
              Xác nhận đăng xuất
            </DialogTitle>

            <DialogContent sx={{ p: 0, mb: 3.5 }}>
              <DialogContentText sx={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn rời khỏi phiên làm việc quản trị <span className="font-extrabold text-[#0d8a4f]">ST - Care</span> không?
              </DialogContentText>
            </DialogContent>

            <DialogActions sx={{ p: 0, width: '100%', display: 'flex', gap: 2 }}>
              {/* Button Hủy bỏ: Nền trắng, không viền xanh, bo tròn 2 đầu, hiệu ứng nổi Apple */}
              <Button 
                onClick={() => setLogoutConfirmOpen(false)} 
                fullWidth
                disableElevation
                sx={{ 
                  borderRadius: '9999px', 
                  py: 1.3,
                  textTransform: 'none', 
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  boxShadow: '0 6px 18px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 1) inset',
                  transition: 'all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  '&:hover': { 
                    backgroundColor: '#ffffff', 
                    color: '#0f172a',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(255, 255, 255, 1) inset',
                  },
                  '&:active': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 10px -2px rgba(0, 0, 0, 0.1)',
                  }
                }}
              >
                Hủy bỏ
              </Button>

              {/* Button Đăng xuất: Nền trắng, không viền xanh, bo tròn 2 đầu, hiệu ứng nổi Apple */}
              <Button 
                onClick={handleConfirmLogout} 
                fullWidth
                disableElevation
                sx={{ 
                  borderRadius: '9999px', 
                  py: 1.3,
                  textTransform: 'none', 
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  backgroundColor: '#ffffff',
                  color: '#e11d48',
                  border: '1px solid rgba(225, 29, 72, 0.08)',
                  boxShadow: '0 6px 18px -2px rgba(225, 29, 72, 0.12), 0 2px 6px -1px rgba(225, 29, 72, 0.06), 0 0 0 1px rgba(255, 255, 255, 1) inset',
                  transition: 'all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  '&:hover': { 
                    backgroundColor: '#fff1f2', 
                    color: '#be123c',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 12px 28px -4px rgba(225, 29, 72, 0.22), 0 0 0 1px rgba(255, 255, 255, 1) inset',
                  },
                  '&:active': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 10px -2px rgba(225, 29, 72, 0.15)',
                  }
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

