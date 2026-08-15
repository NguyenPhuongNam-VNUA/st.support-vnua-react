import { validateLoginInput } from '@/lib/validations/auth.validation';
import { signAccessToken } from '@/lib/auth/jwt';
import { authRepository } from '@/repositories/auth/auth.repository';

export interface AuthSessionUser {
  id: number;
  email: string;
  full_name: string | null;
  role: 'admin' | 'student';
  is_active: boolean;
  created_at: string;
}

export interface LoginResult {
  token: string;
  user: AuthSessionUser;
}

export class AuthServiceError extends Error {
  statusCode: number;
  errors?: Record<string, string>;

  constructor(message: string, statusCode = 400, errors?: Record<string, string>) {
    super(message);
    this.name = 'AuthServiceError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export const authService = {
  /**
   * Đăng nhập: Validate dữ liệu đầu vào -> Tìm user -> So khớp mật khẩu băm -> Tạo token
   */
  async login(credentials: unknown): Promise<LoginResult> {
    // 1. Validate dữ liệu đầu vào phía Server
    const validation = await validateLoginInput(credentials);
    if (!validation.isValid || !validation.data) {
      throw new AuthServiceError('Dữ liệu đăng nhập không hợp lệ', 422, validation.errors);
    }

    const { email, password } = validation.data;

    // 2. Tìm tài khoản trong database
    const account = await authRepository.findAccountByEmail(email);
    if (!account) {
      throw new AuthServiceError('Tài khoản hoặc mật khẩu không chính xác', 401);
    }

    // 3. Kiểm tra trạng thái hoạt động của tài khoản
    if (account.is_active === false) {
      throw new AuthServiceError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên', 403);
    }

    // 4. Kiểm tra mật khẩu (hàm băm bcrypt qua verify_password)
    const isPasswordValid = await authRepository.verifyPassword(password, account.password_hash);
    if (!isPasswordValid) {
      throw new AuthServiceError('Tài khoản hoặc mật khẩu không chính xác', 401);
    }

    // 5. Ký JWT thật bằng jose. Token chỉ chứa định danh và vai trò tối thiểu.
    const token = await signAccessToken({ userId: account.id, role: account.role });

    // 6. Trả về thông tin an toàn của user
    const user: AuthSessionUser = {
      id: account.id,
      email: account.email,
      full_name: account.full_name,
      role: account.role,
      is_active: account.is_active,
      created_at: account.created_at,
    };

    return { token, user };
  },

  /**
   * Lấy thông tin tài khoản hiện tại từ token / ID
   */
  async getCurrentUser(userId: number): Promise<AuthSessionUser> {
    const account = await authRepository.getAccountById(userId);
    if (!account) {
      throw new AuthServiceError('Không tìm thấy thông tin tài khoản', 404);
    }
    if (!account.is_active) {
      throw new AuthServiceError('Tài khoản này đã bị khóa', 403);
    }

    return account as AuthSessionUser;
  },
};
