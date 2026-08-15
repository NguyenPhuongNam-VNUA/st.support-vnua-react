'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  createAccountSchema,
  updateAccountSchema,
  CreateAccountDTO,
  UpdateAccountDTO,
} from '@/lib/validations/account.validation';
import { useAccounts, SanitizedAccount } from '@/hooks/admin/useAccounts';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Shield,
  GraduationCap,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Trash2,
  Edit,
  Lock,
  Mail,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';

export default function AdminAccountsPage() {
  const {
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
    setIsCreateModalOpen,
    setIsEditModalOpen,
    setIsDeleteModalOpen,
    setSelectedAccount,
    fetchAccounts,
    handleCreateAccount,
    handleUpdateAccount,
    handleDeleteAccount,
    clearAlerts,
  } = useAccounts();

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // Menu action state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTargetAccount, setMenuTargetAccount] = useState<SanitizedAccount | null>(null);

  // Form for Creating Account
  const createForm = useForm<CreateAccountDTO>({
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      role: 'student',
      is_active: true,
    },
    resolver: yupResolver(createAccountSchema) as any,
  });

  // Form for Editing Account
  const editForm = useForm<UpdateAccountDTO>({
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      role: 'student',
      is_active: true,
    },
    resolver: yupResolver(updateAccountSchema) as any,
  });

  const handleOpenCreate = () => {
    createForm.reset({
      email: '',
      password: '',
      full_name: '',
      role: 'student',
      is_active: true,
    });
    setShowPassword(false);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (account: SanitizedAccount) => {
    setSelectedAccount(account);
    editForm.reset({
      email: account.email,
      full_name: account.full_name || '',
      role: account.role,
      is_active: account.is_active,
      password: '',
    });
    setShowPassword(false);
    setIsEditModalOpen(true);
    handleCloseMenu();
  };

  const handleOpenDelete = (account: SanitizedAccount) => {
    setSelectedAccount(account);
    setIsDeleteModalOpen(true);
    handleCloseMenu();
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, account: SanitizedAccount) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTargetAccount(account);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuTargetAccount(null);
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAccounts({ page: 1 });
  };

  // KPIs
  const adminCount = accounts.filter((a) => a.role === 'admin').length;
  const studentCount = accounts.filter((a) => a.role === 'student').length;
  const activeCount = accounts.filter((a) => a.is_active).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification Feedback */}
      <Snackbar
        open={!!successAlert}
        autoHideDuration={4000}
        onClose={clearAlerts}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={clearAlerts} severity="success" sx={{ width: '100%' }}>
          {successAlert}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorAlert}
        autoHideDuration={6000}
        onClose={clearAlerts}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={clearAlerts} severity="error" sx={{ width: '100%' }}>
          {errorAlert}
        </Alert>
      </Snackbar>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[rgba(13,138,79,0.08)] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0d8a4f] uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            Quản trị phân quyền hệ thống
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            Quản Lý Tài Khoản
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Thêm mới, phân quyền và quản lý tài khoản người dùng kết nối trực tiếp với Supabase Database
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d8a4f] hover:bg-[#0a7543] text-white font-medium text-sm transition-all shadow-sm hover:shadow-md cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Thêm tài khoản mới
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-[rgba(13,138,79,0.08)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng tài khoản</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0d8a4f] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-2">{total}</p>
          <span className="text-[11px] text-slate-400">Trên hệ thống</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[rgba(13,138,79,0.08)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Quản trị viên (Admin)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-2">{adminCount}</p>
          <span className="text-[11px] text-purple-600 font-medium">Toàn quyền hệ thống</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[rgba(13,138,79,0.08)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Sinh viên (Student)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-2">{studentCount}</p>
          <span className="text-[11px] text-blue-600 font-medium">Người dùng Chatbot</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[rgba(13,138,79,0.08)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đang hoạt động</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-2">{activeCount}</p>
          <span className="text-[11px] text-emerald-600">Trạng thái Active</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[rgba(13,138,79,0.08)] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={onSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo email, họ tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0d8a4f] focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium transition shrink-0 cursor-pointer"
          >
            Tìm kiếm
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium">Vai trò:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-transparent border-none text-slate-800 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="admin">Quản trị viên (Admin)</option>
              <option value="student">Sinh viên (Student)</option>
            </select>
          </div>

          <button
            onClick={() => fetchAccounts()}
            title="Làm mới danh sách"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0d8a4f]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-[rgba(13,138,79,0.08)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">ID</th>
                <th className="py-3.5 px-4 sm:px-6">Người dùng / Email</th>
                <th className="py-3.5 px-4 sm:px-6">Vai trò</th>
                <th className="py-3.5 px-4 sm:px-6">Trạng thái</th>
                <th className="py-3.5 px-4 sm:px-6">Ngày tạo</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <CircularProgress size={28} sx={{ color: '#0d8a4f' }} />
                    <p className="mt-2 text-xs">Đang tải danh sách tài khoản từ Supabase...</p>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Không tìm thấy tài khoản nào</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Thử tìm kiếm từ khóa khác hoặc bấm nút &quot;Thêm tài khoản mới&quot;
                    </p>
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-xs text-slate-400">
                      #{acc.id}
                    </td>

                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100/70 text-[#0d8a4f] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {acc.full_name
                            ? acc.full_name.charAt(0)
                            : acc.email.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-xs sm:text-sm">
                            {acc.full_name || 'Chưa đặt tên'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {acc.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6">
                      {acc.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          <Shield className="w-3 h-3" />
                          Quản trị viên
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <GraduationCap className="w-3 h-3" />
                          Sinh viên
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 sm:px-6">
                      {acc.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Tạm khóa
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-xs text-slate-500 font-mono">
                      {acc.created_at
                        ? new Date(acc.created_at).toLocaleDateString('vi-VN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })
                        : '—'}
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(acc)}
                          title="Chỉnh sửa"
                          className="p-1.5 text-slate-500 hover:text-[#0d8a4f] hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(acc)}
                          title="Xóa tài khoản"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Trang <strong>{page}</strong> / <strong>{totalPages}</strong> (Tổng cộng {total} tài khoản)
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium transition cursor-pointer"
              >
                Trước
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium transition cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: THÊM TÀI KHOẢN MỚI                                 */}
      {/* ======================================================== */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => !isSubmitting && setIsCreateModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '20px', padding: '8px' },
        }}
      >
        <form onSubmit={createForm.handleSubmit(handleCreateAccount)}>
          <DialogTitle sx={{ pb: 1 }}>
            <div className="flex items-center gap-2 text-[#0d8a4f]">
              <UserPlus className="w-5 h-5" />
              <span className="font-bold text-lg text-slate-800">Thêm Tài Khoản Mới</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-normal">
              Tài khoản sẽ được mã hóa mật khẩu bằng pgcrypto và lưu vào bảng accounts trong Supabase.
            </p>
          </DialogTitle>

          <DialogContent className="space-y-4 pt-3">
            {/* Họ và tên */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Họ và tên
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  {...createForm.register('full_name')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#0d8a4f] transition"
                />
              </div>
              {createForm.formState.errors.full_name && (
                <p className="text-xs text-red-500 mt-1">
                  {createForm.formState.errors.full_name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email đăng nhập <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="admin@vnua.edu.vn hoặc user@vnua.edu.vn"
                  {...createForm.register('email')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#0d8a4f] transition"
                />
              </div>
              {createForm.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">
                  {createForm.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Mật khẩu */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu khởi tạo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tối thiểu 6 ký tự"
                  {...createForm.register('password')}
                  className="w-full pl-9 pr-10 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#0d8a4f] transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {createForm.formState.errors.password && (
                <p className="text-xs text-red-500 mt-1">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Vai trò */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vai trò phân quyền <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-[#0d8a4f] cursor-pointer transition">
                  <input
                    type="radio"
                    value="student"
                    {...createForm.register('role')}
                    className="accent-[#0d8a4f]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Sinh viên</p>
                    <p className="text-[10px] text-slate-400">Quyền hỏi đáp Chatbot</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-[#0d8a4f] cursor-pointer transition">
                  <input
                    type="radio"
                    value="admin"
                    {...createForm.register('role')}
                    className="accent-[#0d8a4f]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Quản trị viên</p>
                    <p className="text-[10px] text-slate-400">Toàn quyền hệ thống Admin</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Trạng thái hoạt động */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...createForm.register('is_active')}
                  className="w-4 h-4 rounded text-[#0d8a4f] accent-[#0d8a4f]"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Kích hoạt tài khoản ngay sau khi tạo
                </span>
              </label>
            </div>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
              sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="contained"
              sx={{
                bgcolor: '#0d8a4f',
                '&:hover': { bgcolor: '#0a7543' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '10px',
                px: 3,
              }}
            >
              {isSubmitting ? (
                <>
                  <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                  Đang lưu...
                </>
              ) : (
                'Tạo tài khoản'
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL: CHỈNH SỬA TÀI KHOẢN                                */}
      {/* ======================================================== */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '20px', padding: '8px' },
        }}
      >
        <form
          onSubmit={editForm.handleSubmit((data) =>
            selectedAccount ? handleUpdateAccount(selectedAccount.id, data) : undefined
          )}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <div className="flex items-center gap-2 text-[#0d8a4f]">
              <Edit className="w-5 h-5" />
              <span className="font-bold text-lg text-slate-800">Chỉnh Sửa Tài Khoản</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-normal">
              Cập nhật thông tin tài khoản #{selectedAccount?.id}
            </p>
          </DialogTitle>

          <DialogContent className="space-y-4 pt-3">
            {/* Họ và tên */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Họ và tên</label>
              <input
                type="text"
                {...editForm.register('full_name')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#0d8a4f] transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                {...editForm.register('email')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#0d8a4f] transition"
              />
            </div>

            {/* Mật khẩu mới (Tùy chọn) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu mới (Để trống nếu không muốn đổi)
              </label>
              <input
                type="password"
                placeholder="Nhập mật khẩu mới nếu muốn thay đổi"
                {...editForm.register('password')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#0d8a4f] transition font-mono"
              />
            </div>

            {/* Vai trò */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vai trò</label>
              <select
                {...editForm.register('role')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#0d8a4f] transition bg-white"
              >
                <option value="student">Sinh viên (Student)</option>
                <option value="admin">Quản trị viên (Admin)</option>
              </select>
            </div>

            {/* Trạng thái */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...editForm.register('is_active')}
                  className="w-4 h-4 rounded text-[#0d8a4f] accent-[#0d8a4f]"
                />
                <span className="text-xs font-semibold text-slate-700">Tài khoản đang hoạt động</span>
              </label>
            </div>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
              sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="contained"
              sx={{
                bgcolor: '#0d8a4f',
                '&:hover': { bgcolor: '#0a7543' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '10px',
                px: 3,
              }}
            >
              {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: XÁC NHẬN XÓA TÀI KHOẢN                            */}
      {/* ======================================================== */}
      <Dialog
        open={isDeleteModalOpen}
        onClose={() => !isSubmitting && setIsDeleteModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '20px', padding: '8px' },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span className="font-bold text-lg text-slate-800">Xóa Tài Khoản?</span>
          </div>
        </DialogTitle>

        <DialogContent>
          <p className="text-xs sm:text-sm text-slate-600">
            Bạn có chắc chắn muốn xóa tài khoản <strong>{selectedAccount?.email}</strong> (
            {selectedAccount?.full_name || 'Chưa đặt tên'}) không? Hành động này không thể hoàn tác.
          </p>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setIsDeleteModalOpen(false)}
            disabled={isSubmitting}
            sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}
          >
            Hủy
          </Button>
          <Button
            onClick={() => selectedAccount && handleDeleteAccount(selectedAccount.id)}
            disabled={isSubmitting}
            variant="contained"
            color="error"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '10px',
              px: 3,
            }}
          >
            {isSubmitting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
