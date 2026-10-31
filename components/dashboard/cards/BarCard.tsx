'use client';

import { useEffect, useMemo, useState } from "react";
import { BarChart } from "@mui/x-charts";
import { Card, CardHeader, CardContent, Typography, Box, CircularProgress } from "@mui/material";
import { BarChart3 } from "lucide-react";
import { normalizeQuestion } from "@/lib/training/topic-suggester";

interface BarCardProps {
  /** Logs already limited to the dashboard time filter. */
  logs: { question?: string }[];
  loading?: boolean;
}

export default function BarCard({ logs, loading = false }: BarCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const topQuestions = useMemo(() => {
    const groups = new Map<string, { question: string; ask_count: number }>();
    for (const log of logs) {
      const question = (log.question || '').trim();
      const key = normalizeQuestion(question);
      if (!key) continue;
      const group = groups.get(key);
      if (group) group.ask_count += 1;
      else groups.set(key, { question, ask_count: 1 });
    }
    return Array.from(groups.values()).sort((a, b) => b.ask_count - a.ask_count).slice(0, 5);
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
            <div className="w-8 h-8 rounded-xl bg-[#f3f4f6] text-[#1f2937] flex items-center justify-center border border-[#e5e7eb]/60">
              <BarChart3 className="w-4 h-4" />
            </div>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#1f2937', letterSpacing: '-0.025em', fontSize: { xs: '1rem', sm: '1.05rem' } }}>
              Top 5 câu hỏi được quan tâm nhất
            </Typography>
          </Box>
        }
        sx={{ pb: 0, p: 2.5 }}
      />
      <CardContent sx={{ pt: 1, px: { xs: 1.5, sm: 2.5 }, pb: 2.5 }}>
        {(loading || !mounted) ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={6}>
            <CircularProgress size={32} sx={{ color: '#1f2937' }} />
          </Box>
        ) : topQuestions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={6}>
            Chưa có câu hỏi nào trong khoảng thời gian này.
          </Typography>
        ) : (
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Box sx={{ minWidth: 320, height: 250, display: 'flex', justifyContent: 'flex-start' }}>
              <BarChart
                yAxis={[{
                  scaleType: "band",
                  data: topQuestions.map((q) => q.question.length > 14 ? q.question.substring(0, 14) + '...' : q.question),
                  tickLabelStyle: { fontSize: 11, fontWeight: 500, fill: '#374151' },
                }]}
                xAxis={[
                  {
                    label: "Số lượt hỏi",
                    min: 0,
                    max: Math.max(...topQuestions.map((q) => q.ask_count), 0) + 10,
                    tickMinStep: 1,
                  },
                ]}
                series={[
                  { data: topQuestions.map((q) => q.ask_count), label: "Lượt hỏi", color: "#1f2937" },
                ]}
                layout="horizontal"
                height={240}
                margin={{ left: 65, right: 20, top: 10, bottom: 40 }}
              />
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
