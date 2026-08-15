import { getSupabaseAdmin } from '@/utils/supabase/admin';

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
   * Tìm kiếm tài khoản theo email (không phân biệt hoa thường)
   */
  async findAccountByEmail(email: string): Promise<AccountModel | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    if (error) {
      console.error('Lỗi truy vấn tài khoản theo email trong authRepository:', error);
      throw new Error(`Lỗi truy vấn cơ sở dữ liệu: ${error.message}`);
    }

    return data as AccountModel | null;
  },

  /**
   * Xác thực mật khẩu thông qua hàm verify_password (pgcrypto) trong Supabase
   */
  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc('verify_password', {
      p_input_password: password,
      p_password_hash: passwordHash,
    });

    if (error) {
      console.error('Lỗi khi gọi RPC verify_password:', error);
      throw new Error(`Lỗi xác thực mật khẩu từ cơ sở dữ liệu: ${error.message}`);
    }

    return !!data;
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
