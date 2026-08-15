import * as Yup from 'yup';

export type AccountRole = 'admin' | 'student';

export interface CreateAccountDTO {
  email: string;
  password: string;
  full_name?: string;
  role: AccountRole;
  is_active?: boolean;
}

export interface UpdateAccountDTO {
  email?: string;
  password?: string;
  full_name?: string;
  role?: AccountRole;
  is_active?: boolean;
}

export const createAccountSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .required('Email là bắt buộc')
    .email('Email không đúng định dạng'),
  password: Yup.string()
    .required('Mật khẩu là bắt buộc')
    .min(8, 'Mật khẩu phải có tối thiểu 8 ký tự'),
  full_name: Yup.string()
    .trim()
    .nullable()
    .transform((curr, orig) => orig === '' ? null : curr)
    .max(100, 'Họ và tên không được vượt quá 100 ký tự'),
  role: Yup.string()
    .oneOf(['admin', 'student'], 'Vai trò chỉ có thể là admin hoặc student')
    .required('Vui lòng chọn vai trò'),
  is_active: Yup.boolean().default(true),
});

export const updateAccountSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .email('Email không đúng định dạng')
    .optional(),
  password: Yup.string()
    .transform((curr, orig) => orig === '' ? undefined : curr)
    .min(8, 'Mật khẩu mới phải có tối thiểu 8 ký tự')
    .optional(),
  full_name: Yup.string()
    .trim()
    .nullable()
    .transform((curr, orig) => orig === '' ? null : curr)
    .max(100, 'Họ và tên không được vượt quá 100 ký tự')
    .optional(),
  role: Yup.string()
    .oneOf(['admin', 'student'], 'Vai trò chỉ có thể là admin hoặc student')
    .optional(),
  is_active: Yup.boolean().optional(),
});

export async function validateCreateAccountInput(data: unknown): Promise<{
  isValid: boolean;
  errors?: Record<string, string>;
  data?: CreateAccountDTO;
}> {
  try {
    const validatedData = await createAccountSchema.validate(data, { abortEarly: false, stripUnknown: true });
    return { isValid: true, data: validatedData as CreateAccountDTO };
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

export async function validateUpdateAccountInput(data: unknown): Promise<{
  isValid: boolean;
  errors?: Record<string, string>;
  data?: UpdateAccountDTO;
}> {
  try {
    const validatedData = await updateAccountSchema.validate(data, { abortEarly: false, stripUnknown: true });
    return { isValid: true, data: validatedData as UpdateAccountDTO };
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
