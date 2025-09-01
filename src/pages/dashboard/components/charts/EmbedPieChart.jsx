import PieCard from "../cards/PieCard";

export default function EmbedPieChart({ total, doneEmbed }) {
    const notDoneEmbed = total - doneEmbed;
    const percentEmbedDone = total > 0 ? ((doneEmbed / total) * 100).toFixed(1) : "0";

    return (
        <PieCard
            title={`Tình trạng Embedding (Tổng: ${total})`}
            data={[
                { id: 0, value: doneEmbed, label: "Đã embed" },
                { id: 1, value: notDoneEmbed, label: "Chưa embed" }
            ]}
            stats={[
                { label: "Đã embed", value: `${doneEmbed} (${percentEmbedDone}%)`, color: "success.main" },
                { label: "Chưa embed", value: `${notDoneEmbed} (${(100 - Number(percentEmbedDone)).toFixed(1)}%)`, color: "error.main" }
            ]}
            colors={["#1976d2", "#d32f2f"]}
        />
    );
}
