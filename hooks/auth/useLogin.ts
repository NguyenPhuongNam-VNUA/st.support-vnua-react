'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { LoginFormValues } from '@/lib/validations/auth.validation';

export function useLogin() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [infoAlert, setInfoAlert] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Preload trước trang /admin/dashboard để điều hướng tức thì sau khi đăng nhập thành công
  useEffect(() => {
    try {
      router.prefetch('/admin/dashboard');
    } catch {
      // Bỏ qua nếu môi trường test/SSR
    }
  }, [router]);

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
      const response = await axios.post('/api/auth/login', credentials);
      const resData = response.data;

      if (resData.success && resData.data) {
        const { user } = resData.data;

        // JWT đã được server lưu trong cookie HttpOnly; client chỉ giữ user.
        setUser(user);
        setIsSuccess(true);

        // KIỂM TRA PHÂN QUYỀN (ROLE AUTHORIZATION)
        if (user.role === 'student') {
          // Sinh viên không có quyền vào trang quản trị Admin
          setInfoAlert('Tài khoản Sinh viên: Chức năng đang phát triển. Vui lòng quay lại sau!');
          return {
            success: true,
            isStudent: true,
            message: 'Tài khoản Sinh viên: Chức năng đang phát triển. Vui lòng quay lại sau!',
            data: resData.data,
          };
        }

        // Quản trị viên (Admin) được phép vào Admin Dashboard
        if (redirectPath) {
          router.push(redirectPath);
        }

        return { success: true, isStudent: false, data: resData.data };
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
