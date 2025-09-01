import PieCard from "../cards/PieCard";

export default function AnswerPieChart({ total, doneAnswer }) {
  const notDoneAnswer = total - doneAnswer;
  const percentAnswerDone = total > 0 ? ((doneAnswer / total) * 100).toFixed(1) : "0";

  return (
    <PieCard
      title={`Tình trạng trả lời (Tổng: ${total})`}
      data={[
        { id: 0, value: doneAnswer, label: "Đã có câu trả lời" },
        { id: 1, value: notDoneAnswer, label: "Chưa có câu trả lời" }
      ]}
      stats={[
        { label: "Đã có", value: `${doneAnswer} (${percentAnswerDone}%)`, color: "success.main" },
        { label: "Chưa có", value: `${notDoneAnswer} (${(100 - Number(percentAnswerDone)).toFixed(1)}%)`, color: "error.main" }
      ]}
    />
  );
}
