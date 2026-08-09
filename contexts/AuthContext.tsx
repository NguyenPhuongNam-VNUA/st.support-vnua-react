'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import loginApi from '@/api/auth/loginApi';

const AuthContext = createContext<any>({});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any>(() => {
        if (typeof window !== 'undefined') {
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
                try {
                    return JSON.parse(savedUser);
                } catch (e) {
                    console.error('Lỗi đọc user từ localStorage:', e);
                }
            }
        }
        return null;
    });

    const [token, setToken] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('token') || null;
        }
        return null;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (token) {
                localStorage.setItem('token', token);
            } else {
                localStorage.removeItem('token');
            }
        }
    }, [token]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
            } else {
                localStorage.removeItem('user');
            }
        }
    }, [user]);

    useEffect(() => {
        const fetchUser = async () => {
            if (!token) {
                setUser(null);
                return;
            }

            // Nếu là token đăng nhập local tạm thời
            if (token.startsWith('local-')) {
                if (!user) {
                    const defaultEmail = process.env.NEXT_PUBLIC_EMAIL_LOCAL || 'admin@vnua.edu.vn';
                    setUser({
                        id: 1,
                        name: 'Admin Local',
                        email: defaultEmail,
                        role: 'admin'
                    });
                }
                return;
            }

            try {
                const response: any = await loginApi.getUser();
                setUser(response.user);
            } catch (error) {
                console.error('Không thể lấy thông tin người dùng từ backend:', error);
                // Giữ lại local user nếu có
                if (!user || user.id === 1) {
                    console.log('Sử dụng thông tin user local tạm thời');
                } else {
                    setUser(null);
                    setToken(null);
                }
            }
        };

        fetchUser();
    }, [token]);

    const logout = () => {
        setUser(null);
        setToken(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    };

    return (
        <AuthContext.Provider value={{ user, setUser, token, setToken, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
