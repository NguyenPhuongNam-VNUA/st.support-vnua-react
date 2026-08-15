import * as Yup from 'yup';

export interface LoginFormValues {
  email: string;
  password: string;
}

export const loginSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .required('Vui lòng nhập Email hoặc Mã tài khoản')
    .test('valid-email-or-username', 'Email hoặc mã tài khoản không hợp lệ', (value) => {
      if (!value) return false;
      // Cho phép email hoặc mã sinh viên / tên đăng nhập (tối thiểu 3 ký tự)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[a-zA-Z0-9._-]{3,50}$/;
      return emailRegex.test(value) || usernameRegex.test(value);
    }),
  password: Yup.string()
    // Đăng nhập phải chấp nhận chính xác mật khẩu hiện có, kể cả tài khoản
    // legacy có mật khẩu ngắn. Quy tắc độ mạnh chỉ áp dụng khi tạo/đổi mật khẩu.
    .required('Vui lòng nhập mật khẩu'),
});

export async function validateLoginInput(data: unknown): Promise<{
  isValid: boolean;
  errors?: Record<string, string>;
  data?: LoginFormValues;
}> {
  try {
    const validatedData = await loginSchema.validate(data, { abortEarly: false, stripUnknown: true });
    return { isValid: true, data: validatedData as LoginFormValues };
  } catch (err: any) {
    if (err instanceof Yup.ValidationError) {
      const errors: Record<string, string> = {};
      err.inner.forEach((error) => {
        if (error.path && !errors[error.path]) {
          errors[error.path] = error.message;
        }
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { form: 'Dữ liệu đầu vào không hợp lệ' } };
  }
}
