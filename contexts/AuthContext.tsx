'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import loginApi from '@/api/auth/loginApi';

const AuthContext = createContext<any>({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => {
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
        const fetchUser = async () => {
            if (!token) {
                setUser(null);
                return;
            }

            try {
                const response: any = await loginApi.getUser();
                setUser(response.user);
            } catch (error) {
                console.error('Không thể lấy thông tin người dùng:', error);
                setUser(null);
                setToken(null);
            }
        };

        fetchUser();
    }, [token]);

    return (
        <AuthContext.Provider value={{ user, setUser, token, setToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
