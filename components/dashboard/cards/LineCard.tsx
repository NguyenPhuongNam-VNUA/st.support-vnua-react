'use client';

import { useState, useEffect } from "react";
import { LineChart } from "@mui/x-charts";
import { Card, CardHeader, CardContent, Typography, Box, CircularProgress } from "@mui/material";
import { TrendingUp } from "lucide-react";

export default function LineCard() {
    const [mounted, setMounted] = useState(false);
    const days = ["01/08", "02/08", "03/08", "04/08", "05/08", "06/08"];
    const convCounts = [15, 28, 42, 105, 89, 120];

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <Card
            sx={{
                borderRadius: 0,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                p: 1,
            }}
        >
            <CardHeader 
                title={
                    <Box display="flex" alignItems="center" gap={1.5}>
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.02em', fontSize: '1.1rem' }}>
                            Xu hướng tương tác theo ngày
                        </Typography>
                    </Box>
                }
                sx={{ pb: 0 }}
            />

            <CardContent sx={{ pt: 1 }}>
                <Box sx={{ width: '100%', height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {mounted ? (
                        <LineChart
                            xAxis={[{ scaleType: "point", data: days }]}
                            series={[{ data: convCounts, label: "Lượt tương tác", area: true, color: "#2563eb" }]}
                            height={240}
                            margin={{ left: 40, right: 20, top: 20, bottom: 40 }}
                        />
                    ) : (
                        <CircularProgress size={32} sx={{ color: '#2563eb' }} />
                    )}
                </Box>
            </CardContent>
        </Card>
    );
}
