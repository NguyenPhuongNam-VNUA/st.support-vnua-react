'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/http/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { LoginFormValues } from '@/lib/validations/auth.validation';

export function useLogin() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [infoAlert, setInfoAlert] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Không prefetch /admin/dashboard trước khi đăng nhập: ở production, Next.js cache
  // kết quả redirect của middleware (chưa có cookie) và router.push sẽ quay lại /login.

  /**
   * Hook trực tiếp điều phối và gọi RESTful API /api/auth/login
   */
  const login = async (credentials: LoginFormValues, redirectPath = '/admin/dashboard') => {
    setIsLoading(true);
    setErrorAlert(null);
    setInfoAlert(null);
    setIsSuccess(false);

    try {
      // Gọi RESTful API Backend
      const resData: any = await apiClient.post('/api/auth/login', credentials);

      if (resData.success && resData.data) {
        const { user } = resData.data;

        // JWT đã được server lưu trong cookie HttpOnly; client chỉ giữ user.
        setUser(user);
        setIsSuccess(true);

        // Server chỉ cấp phiên cho quản trị viên nên có thể vào thẳng Admin Dashboard.
        if (redirectPath) {
          router.push(redirectPath);
        }

        return { success: true, data: resData.data };
      } else {
        const errorMsg = resData.message || 'Đăng nhập không thành công';
        setErrorAlert(errorMsg);
        return { success: false, message: errorMsg };
      }
    } catch (error: any) {
      const serverMessage =
        error?.response?.data?.message ||
        (error?.response?.status === 401
          ? 'Tài khoản hoặc mật khẩu không chính xác'
          : 'Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản và mật khẩu.');

      setErrorAlert(serverMessage);
      return {
        success: false,
        message: serverMessage,
        errors: error?.response?.data?.errors,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const clearAlerts = () => {
    setErrorAlert(null);
    setInfoAlert(null);
  };

  return {
    isLoading,
    errorAlert,
    infoAlert,
    isSuccess,
    login,
    clearAlerts,
    setErrorAlert,
    setInfoAlert,
  };
}

export default useLogin;
