'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LinearProgress from "@mui/material/LinearProgress";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { token } = useAuth();
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const savedToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
        if (!savedToken) {
            router.replace("/login");
        }
    }, [token, router]);

    if (!isMounted) {
        return null;
    }

    if (!token && typeof window !== 'undefined' && !localStorage.getItem('token')) {
        return <LinearProgress />;
    }

    return <>{children}</>;
}

export default ProtectedRoute;