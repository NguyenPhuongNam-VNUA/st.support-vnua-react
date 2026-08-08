'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LinearProgress from "@mui/material/LinearProgress";

const ProtectedRoute = ({ children }) => {
    const { token } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const savedToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
        if (!savedToken) {
            router.replace("/login");
        }
    }, [token, router]);

    if (!token && typeof window !== 'undefined' && !localStorage.getItem('token')) {
        return <LinearProgress />;
    }

    return children || null;
}

export default ProtectedRoute;