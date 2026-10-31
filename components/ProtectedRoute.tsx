'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import { ShieldAlert, LogOut } from 'lucide-react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) return <LinearProgress />;

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl p-6 sm:p-8 border border-gray-200 shadow-md text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#f7f7f7] text-[#4b5563] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-medium text-gray-800">Không đủ quyền truy cập</h2>
          <p className="text-sm text-gray-600">
            Tài khoản <strong>{user.email}</strong> không có quyền truy cập khu vực quản trị.
          </p>
          <button
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
