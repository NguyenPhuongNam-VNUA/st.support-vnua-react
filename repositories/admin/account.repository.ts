import { getSupabaseAdmin } from '@/utils/supabase/admin';
import bcrypt from 'bcryptjs';
import { AccountModel } from '../auth/auth.repository';
import { CreateAccountDTO, UpdateAccountDTO } from '@/lib/validations/account.validation';

export interface AccountListQueryOptions {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface AccountListResult {
  accounts: Omit<AccountModel, 'password_hash'>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const accountRepository = {
  /**
   * Lấy danh sách tài khoản kèm tìm kiếm, phân trang và lọc vai trò
   */
  async getAccounts(options: AccountListQueryOptions = {}): Promise<AccountListResult> {
    const supabase = getSupabaseAdmin();

    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 10));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('accounts')
      .select('id, email, full_name, role, is_active, created_at', { count: 'exact' });

    // Tìm kiếm theo email hoặc họ tên
    if (options.search && options.search.trim() !== '') {
      const keyword = options.search.trim().replace(/[,%()]/g, ' ');
      query = query.or(`email.ilike.%${keyword}%,full_name.ilike.%${keyword}%`);
    }

    // Lọc theo vai trò
    if (options.role && options.role !== 'all') {
      query = query.eq('role', options.role);
    }

    // Sắp xếp theo ngày tạo mới nhất
    query = query.order('id', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('Lỗi khi truy vấn danh sách tài khoản:', error);
      throw new Error(`Lỗi cơ sở dữ liệu: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      accounts: (data || []) as Omit<AccountModel, 'password_hash'>[],
      total,
      page,
      limit,
      totalPages,
    };
  },

  /**
   * Lấy thông tin tài khoản theo ID
   */
  async getAccountById(id: number): Promise<Omit<AccountModel, 'password_hash'> | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('accounts')
      .select('id, email, full_name, role, is_active, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Lỗi lấy tài khoản theo ID:', error);
      throw new Error(`Lỗi cơ sở dữ liệu: ${error.message}`);
    }

    return data as Omit<AccountModel, 'password_hash'> | null;
  },

  /**
   * Kiểm tra xem email đã tồn tại hay chưa (dùng khi tạo mới hoặc sửa)
   */
  async checkEmailExists(email: string, excludeId?: number): Promise<boolean> {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('accounts')
      .select('id')
      .ilike('email', email.trim());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Lỗi kiểm tra email tồn tại:', error);
      throw new Error(`Lỗi cơ sở dữ liệu: ${error.message}`);
    }

    return !!data;
  },

  /**
   * Tạo tài khoản mới: Băm mật khẩu bằng bcrypt trực tiếp trên Node.js rồi lưu vào DB
   */
  async createAccount(data: CreateAccountDTO): Promise<Omit<AccountModel, 'password_hash'>> {
    const supabase = getSupabaseAdmin();

    // 1. Băm mật khẩu qua bcrypt (12 rounds)
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // 2. Chèn vào bảng accounts
    const insertPayload = {
      email: data.email.trim().toLowerCase(),
      password_hash: hashedPassword,
      full_name: data.full_name?.trim() || null,
      role: data.role,
      is_active: data.is_active !== undefined ? data.is_active : true,
    };

    const { data: newAccount, error: insertError } = await supabase
      .from('accounts')
      .insert(insertPayload)
      .select('id, email, full_name, role, is_active, created_at')
      .single();

    if (insertError) {
      console.error('Lỗi khi chèn tài khoản mới:', insertError);
      throw new Error(`Lỗi tạo tài khoản: ${insertError.message}`);
    }

    return newAccount as Omit<AccountModel, 'password_hash'>;
  },

  /**
   * Cập nhật thông tin tài khoản
   */
  async updateAccount(
    id: number,
    data: UpdateAccountDTO
  ): Promise<Omit<AccountModel, 'password_hash'>> {
    const supabase = getSupabaseAdmin();

    const updatePayload: Record<string, any> = {};

    if (data.email) {
      updatePayload.email = data.email.trim().toLowerCase();
    }
    if (data.full_name !== undefined) {
      updatePayload.full_name = data.full_name ? data.full_name.trim() : null;
    }
    if (data.role) {
      updatePayload.role = data.role;
    }
    if (data.is_active !== undefined) {
      updatePayload.is_active = data.is_active;
    }

    // Nếu có cập nhật mật khẩu mới
    if (data.password && data.password.trim() !== '') {
      updatePayload.password_hash = await bcrypt.hash(data.password, 12);
    }

    const { data: updatedAccount, error } = await supabase
      .from('accounts')
      .update(updatePayload)
      .eq('id', id)
      .select('id, email, full_name, role, is_active, created_at')
      .single();

    if (error) {
      console.error('Lỗi khi cập nhật tài khoản:', error);
      throw new Error(`Lỗi cập nhật tài khoản: ${error.message}`);
    }

    return updatedAccount as Omit<AccountModel, 'password_hash'>;
  },

  /**
   * Xóa tài khoản theo ID
   */
  async deleteAccount(id: number): Promise<boolean> {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('accounts').delete().eq('id', id);

    if (error) {
      console.error('Lỗi khi xóa tài khoản:', error);
      throw new Error(`Lỗi xóa tài khoản: ${error.message}`);
    }

    return true;
  },

};
