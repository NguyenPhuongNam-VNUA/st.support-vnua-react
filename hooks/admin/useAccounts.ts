'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CreateAccountDTO, UpdateAccountDTO } from '@/lib/validations/account.validation';
import { AccountModel } from '@/repositories/auth/auth.repository';

export type SanitizedAccount = Omit<AccountModel, 'password_hash'>;

export function useAccounts() {
  const [accounts, setAccounts] = useState<SanitizedAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successAlert, setSuccessAlert] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SanitizedAccount | null>(null);

  /**
   * Hook trực tiếp gọi RESTful API GET /api/admin/accounts
   */
  const fetchAccounts = useCallback(
    async (customParams?: { search?: string; role?: string; page?: number; limit?: number }) => {
      setIsLoading(true);
      setErrorAlert(null);

      try {
        const queryParams = {
          search: customParams?.search !== undefined ? customParams.search : search,
          role: customParams?.role !== undefined ? customParams.role : role,
          page: customParams?.page !== undefined ? customParams.page : page,
          limit: customParams?.limit !== undefined ? customParams.limit : limit,
        };

        // Hook trực tiếp gọi Backend RESTful API
        const response = await axios.get('/api/admin/accounts', { params: queryParams });
        const res = response.data;

        if (res.success && res.data) {
          setAccounts(res.data.accounts || []);
          setTotal(res.data.total || 0);
          setPage(res.data.page || 1);
          setLimit(res.data.limit || 10);
          setTotalPages(res.data.totalPages || 1);
        }
      } catch (err: any) {
        console.error('Lỗi tải danh sách tài khoản trong useAccounts:', err);
        setErrorAlert(err?.response?.data?.message || err?.message || 'Không thể tải danh sách tài khoản');
      } finally {
        setIsLoading(false);
      }
    },
    [search, role, page, limit]
  );

  // Tự động load danh sách tài khoản khi mount hoặc đổi page / role
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  /**
   * Hook trực tiếp gọi RESTful API POST /api/admin/accounts
   */
  const handleCreateAccount = async (data: CreateAccountDTO) => {
    setIsSubmitting(true);
    setErrorAlert(null);
    setSuccessAlert(null);

    try {
      const response = await axios.post('/api/admin/accounts', data);
      const res = response.data;

      if (res.success) {
        setSuccessAlert('Tạo tài khoản mới thành công!');
        setIsCreateModalOpen(false);
        await fetchAccounts({ page: 1 });
        return { success: true, data: res.data };
      } else {
        setErrorAlert(res.message || 'Tạo tài khoản thất bại');
        return { success: false, message: res.message };
      }
    } catch (err: any) {
      console.error('Lỗi khi tạo tài khoản trong useAccounts:', err);
      const msg = err?.response?.data?.message || err?.message || 'Tạo tài khoản thất bại';
      setErrorAlert(msg);
      return {
        success: false,
        message: msg,
        errors: err?.response?.data?.errors,
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Hook trực tiếp gọi RESTful API PUT /api/admin/accounts/:id
   */
  const handleUpdateAccount = async (id: number, data: UpdateAccountDTO) => {
    setIsSubmitting(true);
    setErrorAlert(null);
    setSuccessAlert(null);

    try {
      const response = await axios.put(`/api/admin/accounts/${id}`, data);
      const res = response.data;

      if (res.success) {
        setSuccessAlert('Cập nhật tài khoản thành công!');
        setIsEditModalOpen(false);
        setSelectedAccount(null);
        await fetchAccounts();
        return { success: true, data: res.data };
      } else {
        setErrorAlert(res.message || 'Cập nhật thất bại');
        return { success: false, message: res.message };
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Cập nhật tài khoản thất bại';
      setErrorAlert(msg);
      return { success: false, message: msg, errors: err?.response?.data?.errors };
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Hook trực tiếp gọi RESTful API DELETE /api/admin/accounts/:id
   */
  const handleDeleteAccount = async (id: number) => {
    setIsSubmitting(true);
    setErrorAlert(null);
    setSuccessAlert(null);

    try {
      const response = await axios.delete(`/api/admin/accounts/${id}`);
      const res = response.data;

      if (res.success) {
        setSuccessAlert('Đã xóa tài khoản thành công!');
        setIsDeleteModalOpen(false);
        setSelectedAccount(null);
        await fetchAccounts();
        return { success: true };
      } else {
        setErrorAlert(res.message || 'Xóa tài khoản thất bại');
        return { success: false, message: res.message };
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Xóa tài khoản thất bại';
      setErrorAlert(msg);
      return { success: false, message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearAlerts = () => {
    setErrorAlert(null);
    setSuccessAlert(null);
  };

  return {
    accounts,
    total,
    page,
    limit,
    totalPages,
    search,
    role,
    isLoading,
    isSubmitting,
    errorAlert,
    successAlert,
    isCreateModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    selectedAccount,
    setSearch,
    setRole,
    setPage,
    setLimit,
    setIsCreateModalOpen,
    setIsEditModalOpen,
    setIsDeleteModalOpen,
    setSelectedAccount,
    fetchAccounts,
    handleCreateAccount,
    handleUpdateAccount,
    handleDeleteAccount,
    clearAlerts,
    setErrorAlert,
    setSuccessAlert,
  };
}

export default useAccounts;
