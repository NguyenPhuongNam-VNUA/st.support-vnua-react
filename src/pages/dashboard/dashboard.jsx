import { useEffect, useState } from "react";
import { Grid, Box, Button, Typography, Tooltip } from "@mui/material";
import questionApi from "@/api/Question/questionApi";
import AnswerPieChart from "./components/charts/AnswerPieChart";
import conversationApi from "@/api/Conversation/conversationApi";
import EmbedPieChart from "./components/charts/EmbedPieChart";
import StatCard from "./components/cards/StatCard";
// import LineCard from "./components/cards/LineCard";
import BarCard from "./components/cards/BarCard";
import ConversationLogTable from "./components/cards/ConversationCard";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [doneAnswer, setDoneAnswer] = useState(0);
  const [doneEmbed, setDoneEmbed] = useState(0);
  const [answerNoEmbedData, setAnswerNoEmbedData] = useState([]); 
  const [embedding, setEmbedding] = useState(false);

  const fetchQuestions = async () => {
    try {
      const res = await questionApi.getAll();
      const questions = res.data || [];
      setTotal(questions.length);
      setDoneAnswer(questions.filter((q) => q.has_answer).length);
      setDoneEmbed(questions.filter((q) => q.is_embed).length);
      setAnswerNoEmbedData(questions.filter((q) => q.has_answer && !q.is_embed));
    } catch (err) {
      console.error("Lỗi khi lấy danh sách câu hỏi:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await conversationApi.getAll();
      const conversations = res.data || [];
      setConversationTotal(conversations.length);
    } catch (err) {
      console.error("Lỗi khi lấy danh sách cuộc trò chuyện:", err);
    }
  }

  useEffect(() => {
    fetchQuestions();
    fetchConversations();
  }, []);

  if (loading) {
    return <Typography textAlign="center">Đang tải dữ liệu...</Typography>;
  }

  const handleEmbedMany = async () => {
    setEmbedding(true);
    try {
      await questionApi.embedMany(answerNoEmbedData);
      alert(`Cập nhật embedding thành công!`);
  
      await fetchQuestions();
    } catch (err) {
      console.error("Lỗi khi embed:", err);
      alert("Có lỗi xảy ra khi cập nhật embedding!");
    } finally {
      setEmbedding(false);
    }
  }

  return (
    <Box p={2}>
      <Grid container spacing={2}>
        {/* Cards thống kê nhỏ */}
        <Grid item xs={12} md={3}>
          <StatCard title="Tổng số câu hỏi" value={total} />
        </Grid>
        <Grid item xs={12} md={2}>
          <StatCard title="Có câu trả lời" value={doneAnswer} />
        </Grid>
        <Grid item xs={12} md={2}>
          <StatCard title="Đã embed" value={doneEmbed} />
        </Grid>
        <Grid item xs={12} md={2}>
          <StatCard title="Chưa embed" value={total - doneEmbed} color="error.main" />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard title="Tổng số lượt hỏi" value={ conversationTotal } color="success" />
        </Grid>

        {/* Biểu đồ Pie Charts */}
        <Grid item xs={12} md={6}>
          <AnswerPieChart total={total} doneAnswer={doneAnswer} />
        </Grid>
        <Grid item xs={12} md={6}>
          <EmbedPieChart total={total} doneEmbed={doneEmbed} />
        </Grid>
      </Grid>

      {/* Nút hành động */}
      <Box mt={3} textAlign="center">
        <Tooltip
          title={(
            <Box sx={{ p: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                Cập nhật Embedding các câu hỏi <b>đã có câu trả lời</b> nhưng <b>chưa được embed</b>.
              </Typography>
            </Box>
          )}
        >
          <span>
            <Button
              variant="contained"
              color="primary"
              size="large"
              disabled={answerNoEmbedData.length === 0 || embedding}
              onClick={handleEmbedMany}
            >
              {embedding ? "Đang cập nhật..." : "Cập nhật Embedding"}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Biểu đồ Line Charts */}
      {/* <Grid container spacing={2} mt={2}>
        <Grid item xs={12}>
          <LineCard />
        </Grid>
      </Grid> */}

      {/* Biểu đồ Bar Charts */}
      <Grid container spacing={2} mt={2}>
        <Grid item xs={12}>
          <BarCard />
        </Grid>
      </Grid>

      <Grid container spacing={2} mt={2}>
        <Grid item xs={12}>
          <ConversationLogTable />
        </Grid>
      </Grid>
    </Box>
  );
}
