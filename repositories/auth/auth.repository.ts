import { getSupabaseAdmin } from '@/utils/supabase/admin';
import bcrypt from 'bcryptjs';

export interface AccountModel {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: 'admin' | 'student';
  is_active: boolean;
  created_at: string;
}

export const authRepository = {
  /**
   * Tìm kiếm tài khoản theo email (tối ưu chọn đúng các trường cần thiết)
   */
  async findAccountByEmail(email: string): Promise<AccountModel | null> {
    const supabase = getSupabaseAdmin();
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase
      .from('accounts')
      .select('id, email, password_hash, full_name, role, is_active, created_at')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error('Lỗi truy vấn tài khoản theo email trong authRepository:', error);
      throw new Error(`Lỗi truy vấn cơ sở dữ liệu: ${error.message}`);
    }

    return data as AccountModel | null;
  },

  /**
   * Xác thực mật khẩu thông qua thư viện bcrypt trên Node.js server
   * Giúp loại bỏ lượt gọi mạng RPC thứ 2 tới DB, tăng tốc độ phản hồi gấp đôi
   */
  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    if (!password || !passwordHash) return false;
    try {
      return await bcrypt.compare(password, passwordHash);
    } catch (error) {
      console.error('Lỗi so khớp mật khẩu bằng bcrypt:', error);
      return false;
    }
  },

  /**
   * Lấy thông tin tài khoản an toàn theo ID (không bao gồm password_hash)
   */
  async getAccountById(id: number): Promise<Omit<AccountModel, 'password_hash'> | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('accounts')
      .select('id, email, full_name, role, is_active, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Lỗi lấy tài khoản theo ID trong authRepository:', error);
      throw new Error(`Lỗi truy vấn cơ sở dữ liệu: ${error.message}`);
    }

    return data as Omit<AccountModel, 'password_hash'> | null;
  },
};
