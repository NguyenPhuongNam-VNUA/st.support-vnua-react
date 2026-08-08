import { useEffect, useState } from "react";
import { BarChart } from "@mui/x-charts";
import { Card, CardHeader, CardContent, Typography } from "@mui/material";
import questionApi from "@/api/admin/questionApi";

export default function BarCard() {
  const [topQuestions, setTopQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopQuestions = async () => {
      try {
        const res: any = await questionApi.getTop5();
        setTopQuestions(res.data || []);
      } catch (err) {
        console.error("Lỗi khi lấy top 5 câu hỏi:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopQuestions();
  }, []);

  if (loading) {
    return (
      <Typography textAlign="center" mt={2}>
        Đang tải Top 5 câu hỏi...
      </Typography>
    );
  }

  return (
    <Card>
      <CardHeader
        title={
          <Typography
            textAlign="center"
            fontWeight={600}
            mt={2}
            sx={{ fontSize: 20 }}
          >
            Top 5 câu hỏi được hỏi nhiều nhất
          </Typography>
        }
      />
      <CardContent>
        <BarChart
          yAxis={[{ scaleType: "band", data: topQuestions.map((q) => q.question) }]}
          xAxis={[
            {
              label: "Số lượt hỏi",
              min: 0,
              max: Math.max(...topQuestions.map((q) => q.ask_count), 0) + 2,
              tickMinStep: 1,
            },
          ]}
          series={[
            { data: topQuestions.map((q) => q.ask_count), label: "Lượt hỏi" },
          ]}
          layout="horizontal"
          width={800}
          height={230}
        />
      </CardContent>
    </Card>
  );
}
