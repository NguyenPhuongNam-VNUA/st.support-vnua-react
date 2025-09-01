import { Card, CardContent, Typography, Box, Grid } from "@mui/material";
import { PieChart } from "@mui/x-charts/PieChart";

export default function PieCard({ title, data, stats, colors }) {
  return (
    <Card sx={{ p: 2, borderRadius: 3, boxShadow: 2 }}>
      <CardContent>
        <Typography textAlign="center" fontWeight={600} mb={1}>
          {title}
        </Typography>
        <Box display="flex" justifyContent="center" alignItems="center">
          <PieChart
            series={[{
              data,
              highlightScope: { fade: "global", highlight: "item" },
              faded: { innerRadius: 30, additionalRadius: -30, color: "gray" }
            }]}
            width={250}
            height={150}
            colors={colors}
          />
        </Box>
        <Grid container spacing={1} justifyContent="center" mt={1}>
          {stats.map((s, i) => (
            <Grid item xs={6} key={i} textAlign="center">
              <Typography variant="body2" color={s.color || "text.primary"}>
                {s.label}
              </Typography>
              <Typography variant="h6">{s.value}</Typography>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}
