'use client';

import { useEffect, useState } from "react";
import { BarChart } from "@mui/x-charts";
import { Card, CardHeader, CardContent, Typography, Box, CircularProgress } from "@mui/material";
import { BarChart3 } from "lucide-react";
import questionApi from "@/api/admin/questionApi";

const MOCK_TOP_QUESTIONS = [
  { question: "Điểm chuẩn ngành CNTT năm 2025?", ask_count: 142 },
  { question: "Học phí tín chỉ của khoa?", ask_count: 98 },
  { question: "Thời gian xét tuyển đợt 1?", ask_count: 75 },
  { question: "Các ngành đào tạo của Khoa?", ask_count: 62 },
  { question: "Điều kiện nhận học bổng?", ask_count: 45 },
];

export default function BarCard() {
  const [topQuestions, setTopQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchTopQuestions = async () => {
      try {
        const res: any = await questionApi.getTop5();
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          setTopQuestions(res.data);
        } else {
          setTopQuestions(MOCK_TOP_QUESTIONS);
        }
      } catch (err) {
        console.warn("Lỗi khi lấy top 5 câu hỏi (dùng dữ liệu mẫu):", err);
        setTopQuestions(MOCK_TOP_QUESTIONS);
      } finally {
        setLoading(false);
      }
    };
    fetchTopQuestions();
  }, []);

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
              <BarChart3 className="w-4 h-4" />
            </div>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#0d8a4f', letterSpacing: '-0.025em', fontSize: { xs: '1rem', sm: '1.05rem' } }}>
              Top 5 câu hỏi được quan tâm nhất
            </Typography>
          </Box>
        }
        sx={{ pb: 0, p: 2.5 }}
      />
      <CardContent sx={{ pt: 1, px: { xs: 1.5, sm: 2.5 }, pb: 2.5 }}>
        {(loading || !mounted) ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={6}>
            <CircularProgress size={32} sx={{ color: '#0d8a4f' }} />
          </Box>
        ) : (
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Box sx={{ minWidth: 320, height: 250, display: 'flex', justifyContent: 'flex-start' }}>
              <BarChart
                yAxis={[{
                  scaleType: "band",
                  data: topQuestions.map((q) => q.question.length > 14 ? q.question.substring(0, 14) + '...' : q.question),
                  tickLabelStyle: { fontSize: 11, fontWeight: 700, fill: '#334155' },
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
                  { data: topQuestions.map((q) => q.ask_count), label: "Lượt hỏi", color: "#0d8a4f" },
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

