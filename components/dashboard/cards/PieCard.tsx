'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, Typography, Box, Grid, CircularProgress } from "@mui/material";
import { PieChart } from "@mui/x-charts/PieChart";

export default function PieCard({ title, data, stats, colors }: any) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card 
      sx={{ 
        p: 1.5, 
        borderRadius: 0, 
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
      }}
    >
      <CardContent>
        <Typography textAlign="center" fontWeight={800} mb={1.5} sx={{ color: '#2563eb', letterSpacing: '-0.01em', fontSize: '1.05rem' }}>
          {title}
        </Typography>
        <Box display="flex" justifyContent="center" alignItems="center" my={1} sx={{ height: 150 }}>
          {mounted ? (
            <PieChart
              series={[{
                data,
                innerRadius: 35,
                outerRadius: 65,
                paddingAngle: 3,
                cornerRadius: 6,
                highlightScope: { fade: "global", highlight: "item" },
                faded: { innerRadius: 25, additionalRadius: -25, color: "gray" }
              }]}
              width={260}
              height={150}
              colors={colors || ["#059669", "#dc2626"]}
            />
          ) : (
            <CircularProgress size={28} sx={{ color: '#2563eb' }} />
          )}
        </Box>
        <Grid container spacing={2} justifyContent="center" mt={1}>
          {stats.map((s: any, i: number) => (
            <Grid item xs={6} key={i} textAlign="center">
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {s.label}
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: s.color || "#2563eb" }}>
                {s.value}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}
