'use client';

import { useState, useEffect } from 'react';
import * as Yup from 'yup';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Image from 'next/image';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';

import { Eye, EyeOff, Lock, User } from 'lucide-react';

import loginApi from '@/api/auth/loginApi';
import { useAuth } from '@/contexts/AuthContext';

const validationSchema = Yup.object().shape({
  email: Yup.string().required('Vui lòng nhập Email hoặc Mã tài khoản'),
  password: Yup.string().required('Vui lòng nhập mật khẩu'),
});

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [errorAlert, setErrorAlert] = useState(false);

  const methods = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const { setUser, setToken } = useAuth();

  const onSubmit = async (data: any) => {
    const inputEmail = data.email.trim();
    const inputPassword = data.password.trim();

    const envEmail = process.env.NEXT_PUBLIC_EMAIL_LOCAL || process.env.EMAIL_LOCAL || 'admin@vnua.edu.vn';
    const envPass = process.env.NEXT_PUBLIC_PASS_LOCAL || process.env.PASS_LOCAL || '123456';

    // Đăng nhập tạm bằng EMAIL_LOCAL và PASS_LOCAL trong .env
    if (inputEmail === envEmail && inputPassword === envPass) {
      console.log('Đăng nhập bằng tài khoản LOCAL (.env)');
      const mockToken = 'local-admin-token-12345';
      const mockUser = {
        id: 1,
        name: 'Admin Local',
        email: inputEmail,
        role: 'admin',
      };

      setToken(mockToken);
      setUser(mockUser);

      window.location.href = '/admin/dashboard';
      return;
    }

    // Nếu không khớp tài khoản local thì thử gọi API Laravel backend
    try {
      const response: any = await loginApi.login({
        email: inputEmail,
        password: inputPassword,
      });

      console.log('Đăng nhập thành công từ API backend:', response);

      setToken(response.token);
      setUser(response.user);

      window.location.href = '/admin/dashboard';
    } catch (error) {
      console.error('Đăng nhập thất bại:', error);
      setErrorAlert(true);
    }
  };

  useEffect(() => {
    if (errorAlert) {
      const timer = setTimeout(() => setErrorAlert(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorAlert]);

  return (
    <main className="relative min-h-screen w-full overflow-hidden select-none font-sans bg-slate-900 flex flex-col justify-between">
      {/* 1. Pure Background Image - 100% Unfiltered Original Image */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/backgroung.png"
          alt="Tòa nhà Bùi Huy Đáp"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* 2. Left White Translucent Overlay */}
      <div
        className="hidden md:block absolute inset-0 z-10 bg-white/20 pointer-events-none"
        style={{
          clipPath: 'polygon(0 0, 54% 0, 34% 100%, 0 100%)',
        }}
      />

      {/* Fixed Error Alert */}
      {errorAlert && (
        <Box
          sx={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1300,
            minWidth: 320,
          }}
        >
          <Alert
            severity="error"
            variant="filled"
            onClose={() => setErrorAlert(false)}
            sx={{
              borderRadius: '16px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              fontWeight: 600,
            }}
          >
            Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản và mật khẩu.
          </Alert>
        </Box>
      )}

      {/* Top Header Bar */}
      <header className="relative z-30 pt-6 sm:pt-[50px] px-4 sm:px-8 md:pl-[100px] pb-2 sm:pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Image
            src="/st.png"
            alt="ST Logo"
            width={60}
            height={60}
            className="object-contain filter drop-shadow-sm w-11 h-11 sm:w-15 sm:h-15"
          />
          {/* Vertical Divider Line */}
          <div className="h-8 sm:h-11 w-[2px] bg-white/80 rounded-full mx-0.5 sm:mx-1" />
          <div className="flex flex-col justify-center">
            <h2 className="text-xs sm:text-base md:text-lg font-extrabold text-white tracking-tight leading-tight uppercase drop-shadow-sm">
              HỌC VIỆN NÔNG NGHIỆP VIỆT NAM
            </h2>
            <p className="text-[10px] sm:text-xs md:text-sm font-bold text-white leading-tight drop-shadow-xs">
              Khoa công nghệ thông tin
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="relative z-30 flex-1 grid grid-cols-1 md:grid-cols-12 items-center px-4 sm:px-8 md:px-12 py-2 sm:py-4 gap-4 md:gap-0">
        
        {/* Left Section (Slogan Image khau_hieu.png) - Hidden on Mobile, Visible on PC */}
        <div className="hidden md:flex md:col-span-5 items-center justify-center p-2 sm:p-6 md:pl-[60px]">
          <Image
            src="/khau_hieu.png"
            alt="Khẩu hiệu Khoa Công nghệ Thông tin"
            width={520}
            height={350}
            className="object-contain w-full max-w-[460px] h-auto filter drop-shadow-md"
            priority
          />
        </div>

        {/* Right Section (Login Card - Perfectly Centered in Right Half) */}
        <div className="md:col-span-7 flex items-center justify-center py-4 sm:py-6">
          <div className="w-full max-w-[500px] bg-white/95 sm:bg-white p-6 sm:p-9 md:p-12 rounded-2xl shadow-2xl border border-slate-100">
            
            {/* Header Text */}
            <div className="mb-5 sm:mb-6">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                <span className="text-red-600 inline">Xin chào! </span>
                <span className="text-[#134e8e] block sm:inline">Đăng nhập nào.</span>
              </h1>
              
              <p className="text-xs sm:text-sm text-black font-semibold">
                Nhập thông tin của bạn để tiếp tục vào hệ thống.
              </p>
            </div>

            {/* Login Form */}
            <FormProvider {...methods}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Account / Email Input */}
                <div>
                  <label className="block text-xs font-bold text-black mb-1.5">
                    Mã tài khoản / Email
                  </label>
                  <Controller
                    name="email"
                    control={methods.control}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        fullWidth
                        placeholder="admin@vnua.edu.vn"
                        error={!!error}
                        helperText={
                          <span className="italic font-medium text-black">
                            {error?.message || 'Hỗ trợ đăng nhập bằng email hoặc mã tài khoản'}
                          </span>
                        }
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '20px',
                            backgroundColor: '#edf4fc',
                            fontSize: '0.9rem',
                            color: '#000000',
                            fontWeight: 600,
                            '& input::placeholder': {
                              color: '#334155',
                              opacity: 0.85,
                            },
                            '& fieldset': {
                              borderColor: 'transparent',
                            },
                            '&:hover fieldset': {
                              borderColor: '#134e8e',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#134e8e',
                              borderWidth: '1.5px',
                            },
                          },
                          '& .MuiFormHelperText-root': {
                            fontSize: '0.725rem',
                            mt: 0.6,
                            color: '#000000',
                          },
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <User size={18} className="text-black" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-bold text-black mb-1.5">
                    Mật khẩu
                  </label>
                  <Controller
                    name="password"
                    control={methods.control}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        fullWidth
                        placeholder="••••••••"
                        type={showPassword ? 'text' : 'password'}
                        error={!!error}
                        helperText={
                          <span className="italic font-medium text-black">
                            {error?.message || 'Ấn/hiện mật khẩu bằng icon con mắt ở góc phải'}
                          </span>
                        }
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '20px',
                            backgroundColor: '#edf4fc',
                            fontSize: '0.9rem',
                            color: '#000000',
                            fontWeight: 600,
                            '& input::placeholder': {
                              color: '#334155',
                              opacity: 0.85,
                            },
                            '& fieldset': {
                              borderColor: 'transparent',
                            },
                            '&:hover fieldset': {
                              borderColor: '#134e8e',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#134e8e',
                              borderWidth: '1.5px',
                            },
                          },
                          '& .MuiFormHelperText-root': {
                            fontSize: '0.725rem',
                            mt: 0.6,
                            color: '#000000',
                          },
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock size={18} className="text-black" />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <ButtonBase
                                disableRipple
                                disableTouchRipple
                                onClick={() => setShowPassword(!showPassword)}
                                className="p-1 text-black hover:text-slate-800 transition-colors"
                              >
                                {showPassword ? (
                                  <EyeOff size={18} />
                                ) : (
                                  <Eye size={18} />
                                )}
                              </ButtonBase>
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                  sx={{
                    mt: 2,
                    py: 1.5,
                    borderRadius: '20px',
                    backgroundColor: '#134e8e',
                    color: '#ffffff',
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    boxShadow: '0 8px 24px -4px rgba(19, 78, 142, 0.4)',
                    '&:hover': {
                      backgroundColor: '#0e3c6e',
                      boxShadow: '0 10px 28px -4px rgba(19, 78, 142, 0.5)',
                    },
                  }}
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}
                </Button>
              </form>
            </FormProvider>

          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="relative z-30 px-6 py-3 text-center text-xs text-white font-medium">
       © 2026 Software Development and Research Team — All Rights Reserved.
      </footer>
    </main>
  );
}
