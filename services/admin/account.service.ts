import {
  validateCreateAccountInput,
  validateUpdateAccountInput,
  CreateAccountDTO,
  UpdateAccountDTO,
} from '@/lib/validations/account.validation';
import {
  accountRepository,
  AccountListQueryOptions,
  AccountListResult,
} from '@/repositories/admin/account.repository';
import { AccountModel } from '@/repositories/auth/auth.repository';

export class AccountServiceError extends Error {
  statusCode: number;
  errors?: Record<string, string>;

  constructor(message: string, statusCode = 400, errors?: Record<string, string>) {
    super(message);
    this.name = 'AccountServiceError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export const accountService = {
  /**
   * Lấy danh sách tài khoản kèm phân trang và bộ lọc
   */
  async getAccounts(options: AccountListQueryOptions = {}): Promise<AccountListResult> {
    return await accountRepository.getAccounts(options);
  },

  /**
   * Lấy thông tin 1 tài khoản theo ID
   */
  async getAccountById(id: number): Promise<Omit<AccountModel, 'password_hash'>> {
    const account = await accountRepository.getAccountById(id);
    if (!account) {
      throw new AccountServiceError('Không tìm thấy tài khoản', 404);
    }
    return account;
  },

  /**
   * Tạo tài khoản mới:
   * 1. Validate dữ liệu đầu vào bằng Yup (Service validate lần 2)
   * 2. Kiểm tra trùng lặp email
   * 3. Gọi repository băm mật khẩu và lưu vào Supabase DB
   */
  async createAccount(inputData: unknown): Promise<Omit<AccountModel, 'password_hash'>> {
    // 1. Validate dữ liệu đầu vào
    const validation = await validateCreateAccountInput(inputData);
    if (!validation.isValid || !validation.data) {
      throw new AccountServiceError('Dữ liệu tạo tài khoản không hợp lệ', 422, validation.errors);
    }

    const { email, password, full_name, role, is_active } = validation.data;

    // 2. Kiểm tra email đã tồn tại hay chưa
    const emailExists = await accountRepository.checkEmailExists(email);
    if (emailExists) {
      throw new AccountServiceError(`Email '${email}' đã tồn tại trong hệ thống. Vui lòng chọn email khác!`, 409, {
        email: 'Email này đã được sử dụng',
      });
    }

    // 3. Gọi repository tạo tài khoản
    const newAccount = await accountRepository.createAccount({
      email,
      password,
      full_name,
      role,
      is_active: is_active ?? true,
    });

    return newAccount;
  },

  /**
   * Cập nhật thông tin tài khoản
   */
  async updateAccount(
    id: number,
    inputData: unknown
  ): Promise<Omit<AccountModel, 'password_hash'>> {
    // 1. Validate dữ liệu cập nhật
    const validation = await validateUpdateAccountInput(inputData);
    if (!validation.isValid || !validation.data) {
      throw new AccountServiceError('Dữ liệu cập nhật không hợp lệ', 422, validation.errors);
    }

    // 2. Kiểm tra tài khoản có tồn tại không
    const existing = await accountRepository.getAccountById(id);
    if (!existing) {
      throw new AccountServiceError('Không tìm thấy tài khoản cần cập nhật', 404);
    }

    // 3. Nếu thay đổi email, kiểm tra trùng lặp với tài khoản khác
    if (validation.data.email && validation.data.email !== existing.email) {
      const emailExists = await accountRepository.checkEmailExists(validation.data.email, id);
      if (emailExists) {
        throw new AccountServiceError(`Email '${validation.data.email}' đã được sử dụng`, 409, {
          email: 'Email này đã được sử dụng bởi tài khoản khác',
        });
      }
    }

    // 4. Cập nhật
    return await accountRepository.updateAccount(id, validation.data);
  },

  /**
   * Xóa tài khoản
   */
  async deleteAccount(id: number): Promise<boolean> {
    const existing = await accountRepository.getAccountById(id);
    if (!existing) {
      throw new AccountServiceError('Không tìm thấy tài khoản cần xóa', 404);
    }

    return await accountRepository.deleteAccount(id);
  },
};
