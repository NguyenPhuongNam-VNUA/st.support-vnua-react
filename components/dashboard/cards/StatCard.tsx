import React from "react";
import { Card, CardContent, Typography } from "@mui/material";

interface StatCardProps {
  title: string;
  value: number | string;
  percent?: string | number;
  color?: string;
}

export default function StatCard({ title, value, percent, color = "primary.main" }: StatCardProps) {
  return (
    <Card sx={{ p: 2, borderRadius: 3, boxShadow: 2 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" fontWeight={600} color={color}>
          {value}
        </Typography>
        {percent && (
          <Typography variant="body2" color={color}>
            {percent}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
