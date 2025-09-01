import { LineChart } from "@mui/x-charts";
import { Card, CardHeader, CardContent, Typography } from "@mui/material";

export default function LineCard() {
    const days = ["01/08", "02/08", "03/08", "04/08", "05/08", "06/08"];
    const convCounts = [5, 10, 8, 100, null, null];

    return (
        <Card>
            <CardHeader title={(
                <Typography textAlign="center" fontWeight={600} mt={2} sx={{ fontSize: 20 }}>
                    Tổng số lượt hỏi theo ngày
                </Typography>
            )}>
            </CardHeader>

            <CardContent>
                <LineChart
                    xAxis={[{ scaleType: "point", data: days }]}x
                    series={[{ data: convCounts, label: "Conversations", area: true }]}
                    width={800}
                    height={300}
                />
            </CardContent>
        </Card>
    );
}