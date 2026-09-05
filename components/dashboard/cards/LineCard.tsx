'use client';

import { useState, useEffect, useMemo } from "react";
import { LineChart } from "@mui/x-charts";
import { Card, CardHeader, CardContent, Typography, Box, CircularProgress } from "@mui/material";
import { TrendingUp } from "lucide-react";
import conversationApi from "@/api/chatbot/conversationApi";

export default function LineCard() {
    const [mounted, setMounted] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setMounted(true);
        const fetchLogs = async () => {
            try {
                const res: any = await conversationApi.getAll();
                const raw = res && Array.isArray(res.data) ? res.data : [];
                setLogs(raw);
            } catch (err) {
                console.warn("Lỗi tải logs cho LineCard:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const { days, convCounts } = useMemo(() => {
        const labels: string[] = [];
        const map = new Map<string, number>();

        // Generate last 7 days in DD/MM format
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            labels.push(key);
            map.set(key, 0);
        }

        // Tally conversations per day
        logs.forEach((log) => {
            if (log.created_at) {
                const d = new Date(log.created_at);
                const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (map.has(key)) {
                    map.set(key, (map.get(key) || 0) + 1);
                }
            }
        });

        const counts = labels.map((k) => map.get(k) || 0);
        return { days: labels, convCounts: counts };
    }, [logs]);

    return (
        <Card
            className="emerald-card"
            sx={{
                p: 0,
                bgcolor: '#ffffff',
            }}
        >
            <CardHeader 
                title={
                    <Box display="flex" alignItems="center" gap={1.5}>
                        <div className="w-8 h-8 rounded-xl bg-[#f0f8f4] text-[#0d8a4f] flex items-center justify-center border border-[#a7f3d0]/60">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <Typography variant="h6" fontWeight={800} sx={{ color: '#0d8a4f', letterSpacing: '-0.025em', fontSize: { xs: '1rem', sm: '1.05rem' } }}>
                            Xu hướng tương tác theo ngày
                        </Typography>
                    </Box>
                }
                sx={{ pb: 0, p: 2.5 }}
            />

            <CardContent sx={{ pt: 1, px: { xs: 1.5, sm: 2.5 }, pb: 2.5 }}>
                {!mounted ? (
                    <Box display="flex" justifyContent="center" alignItems="center" py={6}>
                        <CircularProgress size={32} sx={{ color: '#0d8a4f' }} />
                    </Box>
                ) : (
                    <Box sx={{ width: '100%', overflowX: 'auto' }}>
                        <Box sx={{ minWidth: 320, height: 250, display: 'flex', justifyContent: 'center' }}>
                            <LineChart
                                xAxis={[{
                                    scaleType: 'point',
                                    data: days,
                                    tickLabelStyle: { fontSize: 11, fontWeight: 700, fill: '#64748b' }
                                }]}
                                series={[
                                    {
                                        data: convCounts,
                                        label: 'Lượt tương tác',
                                        color: '#0d8a4f',
                                        area: true,
                                    },
                                ]}
                                height={240}
                                margin={{ left: 35, right: 20, top: 10, bottom: 25 }}
                            />
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
