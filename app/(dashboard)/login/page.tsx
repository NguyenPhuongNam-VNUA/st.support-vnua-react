"use client";

import { useState, useEffect } from "react";
import * as Yup from "yup";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Image from "next/image";

import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";

import {
  Eye,
  EyeOff,
  Lock,
  User,
  Users,
  ShieldCheck,
  Globe,
  Lightbulb,
  Award,
  ChevronDown,
  Check,
} from "lucide-react";

import { useLogin } from "@/hooks/auth/useLogin";

const translations = {
  VN: {
    university: "HỌC VIỆN NÔNG NGHIỆP VIỆT NAM",
    faculty: "Khoa Công nghệ thông tin",
    slogan1: "Kiến tạo tri thức",
    slogan2: "Vững bước tương lai",
    description:
      "Cùng nhau xây dựng môi trường học tập hiện đại, đoàn kết và phát triển bền vững.",
    cards: [
      { icon: Users, title: "Đoàn kết", subtitle: "Sức mạnh của tập thể" },
      {
        icon: ShieldCheck,
        title: "Trách nhiệm",
        subtitle: "Tận tâm với công việc",
      },
      { icon: Globe, title: "Hội nhập", subtitle: "Kết nối – Phát triển" },
      { icon: Lightbulb, title: "Sáng tạo", subtitle: "Dám nghĩ – Dám làm" },
      { icon: Award, title: "Chất lượng", subtitle: "Uy tín – Bền vững" },
    ],
    loginTitle: "Đăng nhập",
    loginSubtitle: "Nhập thông tin của bạn để tiếp tục vào hệ thống",
    emailLabel: "Email hoặc mã tài khoản",
    emailPlaceholder: "admin@vnua.edu.vn",
    passwordLabel: "Mật khẩu",
    passwordPlaceholder: "••••••••",
    rememberMe: "Ghi nhớ đăng nhập",
    forgotPassword: "Quên mật khẩu?",
    loginBtn: "Đăng nhập",
    loggingIn: "Đang xử lý...",
    or: "hoặc",
    ssoBtn: "Đăng nhập SSO",
    ssoRedirecting: "Đang chuyển hướng SSO...",
    copyright: "© 2026 Software Development and Research Team ",
    subCopyright: "Khoa Công nghệ thông tin",
    emailRequired: "Vui lòng nhập Email hoặc Mã tài khoản",
    passRequired: "Vui lòng nhập mật khẩu",
    forgotNotice:
      "Vui lòng liên hệ Phòng CNTT hoặc Quản trị viên hệ thống để lấy lại mật khẩu.",
    ssoNotice:
      "Đang chuyển hướng sang cổng đăng nhập SSO tập trung của VNUA...",
  },
  EN: {
    university: "VIETNAM NATIONAL UNIVERSITY OF AGRICULTURE",
    faculty: "Faculty of Information Technology",
    slogan1: "Fostering Knowledge",
    slogan2: "Stepping into the Future",
    description:
      "Building a modern, united, and sustainable learning environment together.",
    cards: [
      { icon: Users, title: "Unity", subtitle: "Strength of collective" },
      {
        icon: ShieldCheck,
        title: "Responsibility",
        subtitle: "Dedicated to work",
      },
      { icon: Globe, title: "Integration", subtitle: "Connect – Develop" },
      {
        icon: Lightbulb,
        title: "Creativity",
        subtitle: "Dare to think – Dare to do",
      },
      { icon: Award, title: "Quality", subtitle: "Prestige – Sustainability" },
    ],
    loginTitle: "Sign In",
    loginSubtitle: "Enter your credentials to access the system",
    emailLabel: "Email or Account ID",
    emailPlaceholder: "admin@vnua.edu.vn",
    passwordLabel: "Password",
    passwordPlaceholder: "••••••••",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    loginBtn: "Sign In",
    loggingIn: "Signing in...",
    or: "or",
    ssoBtn: "Sign In with SSO",
    ssoRedirecting: "Redirecting to SSO...",
    copyright: "© 2024 Vietnam National University of Agriculture",
    subCopyright: "Faculty of Information Technology",
    emailRequired: "Please enter your Email or Account ID",
    passRequired: "Please enter your password",
    forgotNotice:
      "Please contact IT Department or System Administrator to reset your password.",
    ssoNotice: "Redirecting to VNUA Centralized SSO Portal...",
  },
};

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [infoAlert, setInfoAlert] = useState<string | null>(null);
  const [lang, setLang] = useState<"VN" | "EN">("VN");
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isSsoLoading, setIsSsoLoading] = useState(false);

  const t = translations[lang];

  const validationSchema = Yup.object().shape({
    email: Yup.string().required(t.emailRequired),
    password: Yup.string().required(t.passRequired),
  });

  const methods = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const { login, isLoading: isLoginLoading } = useLogin();

  const onSubmit = async (data: any) => {
    setErrorAlert(null);
    const inputEmail = data.email.trim();
    // Mật khẩu là dữ liệu nguyên trạng; trim có thể biến mật khẩu đúng thành sai.
    const inputPassword = data.password;

    // Đăng nhập kết nối trực tiếp Supabase qua API & useLogin hook
    const result = await login(
      {
        email: inputEmail,
        password: inputPassword,
      },
      "/admin/dashboard"
    );

    if (result.isStudent) {
      setInfoAlert(
        lang === "VN"
          ? "Đăng nhập thành công! Chức năng dành cho Sinh viên đang phát triển. Vui lòng quay lại sau!"
          : "Sign in successful! Student features are currently under development."
      );
      return;
    }

    if (!result.success) {
      setErrorAlert(
        result.message ||
          (lang === "VN"
            ? "Đăng nhập thất bại! Vui lòng kiểm tra lại email/mã tài khoản và mật khẩu."
            : "Sign in failed! Please check your credentials.")
      );
    }

  };


  const handleSsoLogin = () => {
    setIsSsoLoading(true);
    setInfoAlert(t.ssoNotice);
    setTimeout(() => {
      setIsSsoLoading(false);
      setInfoAlert(
        lang === "VN"
          ? "Cổng đăng nhập SSO đang được bảo trì hoặc liên kết với tài khoản Supabase."
          : "SSO Portal is under maintenance."
      );
    }, 1200);
  };


  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setInfoAlert(t.forgotNotice);
  };

  useEffect(() => {
    if (errorAlert) {
      const timer = setTimeout(() => setErrorAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorAlert]);

  useEffect(() => {
    if (infoAlert) {
      const timer = setTimeout(() => setInfoAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [infoAlert]);

  return (
    <main className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden font-sans select-none bg-slate-900">
      {/* Layer 0: Background Image (may.png - Blue Sky & Clouds) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/may.png"
          alt="Học viện Nông nghiệp Việt Nam - Bầu trời"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Layer 1: Campus Building & Foliage Overlay */}
      <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
        <Image
          src="/leaves_corner.png"
          alt="Học viện Nông nghiệp Việt Nam - Tòa nhà Hành chính & Lá cây"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Floating System Notifications (Alerts) */}
      <Box className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-auto">
        {errorAlert && (
          <Alert
            severity="error"
            onClose={() => setErrorAlert(null)}
            className="shadow-lg rounded-xl font-medium"
          >
            {errorAlert}
          </Alert>
        )}
        {infoAlert && (
          <Alert
            severity="info"
            onClose={() => setInfoAlert(null)}
            className="shadow-lg rounded-xl font-medium"
          >
            {infoAlert}
          </Alert>
        )}
      </Box>

      {/* Top-Left Ambient Light Glow */}
      <div
        className="absolute top-0 left-0 w-full sm:w-[80%] md:w-[70%] lg:w-[55%] h-48 pointer-events-none z-20"
        style={{
          background:
            "radial-gradient(ellipse 95% 100% at 0% 0%, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.88) 40%, rgba(255, 255, 255, 0.45) 70%, rgba(255, 255, 255, 0) 100%)",
          filter: "blur(8px)",
        }}
      />

      {/* Top Header Bar (Full width: Left aligned left, Right aligned right) */}
      <header className="relative z-30 pt-5 px-6 sm:px-10 md:px-12 lg:px-16 w-full flex items-center justify-between">
        {/* Left Logo & Portal Name */}
        <div className="flex items-center gap-3 sm:gap-3.5 select-none">
          <Image
            src="/st.png"
            alt="ST Logo"
            width={48}
            height={48}
            className="object-contain filter drop-shadow-sm"
          />
          {/* Vertical Divider */}
          <div className="h-8 w-[1.5px] bg-[#1e5e2f]/35 rounded-full" />
          <div className="flex flex-col justify-center">
            <h2 className="text-xs sm:text-sm font-extrabold text-[#1e5e2f] tracking-tight uppercase leading-tight drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
              {t.university}
            </h2>
            <p className="text-[11px] font-bold text-[#346944] drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
              {t.faculty}
            </p>
          </div>
        </div>

        {/* Right Action: Language Selector */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/70 hover:bg-white/90 backdrop-blur-md border border-white/80 text-slate-800 text-xs font-extrabold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <span>{lang}</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isLangOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-100 py-1.5 z-40">
                <button
                  type="button"
                  onClick={() => {
                    setLang("VN");
                    setIsLangOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-[#2e7d32] flex items-center justify-between transition-colors"
                >
                  <span>Tiếng Việt (VN)</span>
                  {lang === "VN" && (
                    <Check size={14} className="text-[#2e7d32]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLang("EN");
                    setIsLangOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-[#2e7d32] flex items-center justify-between transition-colors"
                >
                  <span>English (EN)</span>
                  {lang === "EN" && (
                    <Check size={14} className="text-[#2e7d32]" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="relative z-30 flex-1 grid grid-cols-1 lg:grid-cols-12 items-center px-6 sm:px-10 md:px-12 lg:px-16 py-3 sm:py-5 max-w-[1440px] mx-auto w-full gap-8 lg:gap-12">
        {/* Left Section: Slogan & 5 Core Values (Bilingual Dynamic) */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-4 items-start">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.18]">
              <span className="text-slate-900 font-extrabold drop-shadow-[0_2px_10px_rgba(255,255,255,0.8)]">
                {t.slogan1}
              </span>
              <span className="block text-[#2e7d32] mt-0.5 relative drop-shadow-[0_2px_10px_rgba(255,255,255,0.8)]">
                {t.slogan2}
                <span className="block w-16 sm:w-20 h-1 bg-[#f59e0b] rounded-full mt-1.5" />
              </span>
            </h1>
            <p className="text-slate-900 font-bold text-xs sm:text-sm pt-2 leading-relaxed max-w-sm drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)]">
              {t.description}
            </p>
          </div>

          {/* 5 Feature Items with Boundary-Free Radial Ambient Light Glow (Matching Header Light Mask) */}
          <div className="flex flex-col gap-3 max-w-[370px] w-full pt-1">
            {t.cards.map((card, idx) => {
              const IconComp = card.icon;
              return (
                <div
                  key={idx}
                  className="group relative flex items-center gap-3.5 py-2 sm:py-2.5 px-3 transition-transform duration-200 hover:translate-x-1.5 cursor-pointer"
                >
                  {/* Feather-Soft Radial Ambient Light Mask (Zero Visible Edges) */}
                  <div
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                      background:
                        'radial-gradient(ellipse 110% 150% at 0% 50%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.62) 35%, rgba(255, 255, 255, 0.2) 68%, rgba(255, 255, 255, 0) 100%)',
                      filter: 'blur(6px)',
                    }}
                  />

                  <div className="relative z-10 w-10 h-10 rounded-xl bg-white/90 border border-white/90 flex items-center justify-center text-[#2e7d32] shadow-md shrink-0 group-hover:scale-105 transition-transform">
                    <IconComp size={20} strokeWidth={2.2} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)]">
                      {card.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-800 font-bold leading-tight mt-0.5 drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)]">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Section: Floating White Login Card */}
        <div className="lg:col-span-6 flex items-center justify-center lg:justify-end py-2">
          <div className="relative w-full max-w-[370px] min-h-[520px] bg-white/95 backdrop-blur-xl px-6 py-7 sm:px-7 sm:py-8 rounded-[30px] shadow-2xl border border-white/90 overflow-hidden flex flex-col justify-between">
            {/* Top Right Card Leaf Branch Overlay */}
            <div className="absolute top-0 right-0 w-20 sm:w-28 pointer-events-none opacity-90 z-0">
              <Image
                src="/leaf_branch_corner.png"
                alt="Trang trí cành lá"
                width={112}
                height={112}
                className="w-full h-auto"
              />
            </div>

            <div className="relative z-10 flex flex-col justify-between flex-1">
              {/* Login Title */}
              <div className="mb-4">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2e7d32] tracking-tight">
                  {t.loginTitle}
                </h2>
                <div className="w-12 h-1 bg-[#f59e0b] rounded-full mt-1.5 mb-3" />
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {t.loginSubtitle}
                </p>
              </div>

              {/* Login Form */}
              <FormProvider {...methods}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Account / Email Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      {t.emailLabel}
                    </label>
                    <Controller
                      name="email"
                      control={methods.control}
                      render={({ field, fieldState: { error } }) => (
                        <div>
                          <div className="relative flex items-center">
                            <User
                              size={18}
                              className="absolute left-3.5 text-slate-400 pointer-events-none"
                            />
                            <input
                              {...field}
                              type="text"
                              placeholder={t.emailPlaceholder}
                              className={`w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border ${
                                error ? "border-red-500" : "border-slate-200"
                              } rounded-xl text-slate-900 text-sm font-semibold focus:bg-white focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#2e7d32]/20 transition-all placeholder:text-slate-400`}
                            />
                          </div>
                          {error && (
                            <p className="text-[11px] font-semibold text-red-500 mt-1">
                              {error.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      {t.passwordLabel}
                    </label>
                    <Controller
                      name="password"
                      control={methods.control}
                      render={({ field, fieldState: { error } }) => (
                        <div>
                          <div className="relative flex items-center">
                            <Lock
                              size={18}
                              className="absolute left-3.5 text-slate-400 pointer-events-none"
                            />
                            <input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder={t.passwordPlaceholder}
                              className={`w-full pl-10 pr-10 py-2.5 bg-slate-50/60 border ${
                                error ? "border-red-500" : "border-slate-200"
                              } rounded-xl text-slate-900 text-sm font-semibold focus:bg-white focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#2e7d32]/20 transition-all placeholder:text-slate-400`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                            >
                              {showPassword ? (
                                <EyeOff size={18} />
                              ) : (
                                <Eye size={18} />
                              )}
                            </button>
                          </div>
                          {error && (
                            <p className="text-[11px] font-semibold text-red-500 mt-1">
                              {error.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                  </div>

                  {/* Checkbox Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#2e7d32] focus:ring-[#2e7d32] accent-[#2e7d32] cursor-pointer"
                      />
                      <span>{t.rememberMe}</span>
                    </label>
                    <a
                      href="#"
                      onClick={handleForgotPassword}
                      className="text-xs font-bold text-[#2e7d32] hover:underline cursor-pointer"
                    >
                      {t.forgotPassword}
                    </a>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-[#2e6b38] hover:bg-[#23542b] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-[#2e6b38]/25 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
                  >
                    {isSubmitting ? t.loggingIn : t.loginBtn}
                  </button>
                </form>
              </FormProvider>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="h-[1px] flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">
                  {t.or}
                </span>
                <div className="h-[1px] flex-1 bg-slate-200" />
              </div>

              {/* SSO Login Button */}
              <button
                type="button"
                onClick={handleSsoLogin}
                disabled={isSsoLoading}
                className="w-full py-2.5 bg-white hover:bg-slate-50 text-[#2e6b38] border border-slate-200 font-bold text-xs sm:text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-70"
              >
                <ShieldCheck size={18} className="text-[#2e6b38]" />
                <span>{isSsoLoading ? t.ssoRedirecting : t.ssoBtn}</span>
              </button>

              {/* Footer Inside Card */}
              <div className="mt-6 text-center text-[11px] text-slate-400 font-medium space-y-0.5">
                <p>{t.copyright}</p>
                <p>{t.subCopyright}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
