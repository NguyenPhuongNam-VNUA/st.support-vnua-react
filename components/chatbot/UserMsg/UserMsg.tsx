"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface UserMsgProps {
  message: string;
  timestamp?: string;
}

export default function UserMsg({ message, timestamp }: UserMsgProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        my: 1.5,
        alignSelf: "flex-end",
        maxWidth: { md: "75%", sm: "85%", xs: "90%" },
        ml: "auto",
      }}
    >
      <Box
        sx={{
          px: 2.2,
          py: 1.5,
          borderRadius: "20px 20px 4px 20px",
          background: "linear-gradient(135deg, #fee4e0 0%, #fedbd5 100%)",
          color: "#1e293b",
          border: "1px solid rgba(254, 198, 190, 0.85)",
          boxShadow:
            "0 6px 18px -4px rgba(254, 180, 168, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.04)",
          fontSize: "0.925rem",
          lineHeight: 1.55,
          fontWeight: 450,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          letterSpacing: "0.01em",
        }}
      >
        {message}
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: "#64748b",
          fontSize: "0.75rem",
          fontWeight: 500,
          mt: 0.5,
          mr: 1,
        }}
      >
        {timestamp || "Bạn"}
      </Typography>
    </Box>
  );
}
