'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Copy, Check } from 'lucide-react';
import Image from 'next/image';

interface ChatMsgProps {
  message: string;
  timestamp?: string;
}

export default function ChatMsg({ message, timestamp }: ChatMsgProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        my: 1.5,
        maxWidth: { md: '85%', sm: '90%', xs: '95%' },
        animation: 'fadeIn 0.3s ease-out forwards',
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Image
          src="/st.png"
          alt="ST - Care Logo"
          width={36}
          height={36}
          className="object-contain filter drop-shadow-xs"
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 0.5,
            px: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#006837', letterSpacing: '0.02em' }}>
            ST - Care
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
            {timestamp || 'Vừa xong'}
          </Typography>
        </Box>

        <Box
          sx={{
            position: 'relative',
            px: 2.2,
            py: 1.6,
            borderRadius: '4px 20px 20px 20px',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
            color: '#1e293b',
            fontSize: '0.925rem',
            lineHeight: 1.6,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            '&:hover .copy-btn': {
              opacity: 1,
            },
          }}
        >
          {message}

          <Tooltip title={copied ? 'Đã sao chép!' : 'Sao chép câu trả lời'} placement="top">
            <IconButton
              className="copy-btn"
              onClick={handleCopy}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                opacity: 0,
                transition: 'opacity 0.2s ease',
                backgroundColor: 'rgba(241, 245, 249, 0.8)',
                '&:hover': {
                  backgroundColor: 'rgba(226, 232, 240, 0.9)',
                },
                width: 26,
                height: 26,
              }}
            >
              {copied ? <Check size={14} color="#006837" /> : <Copy size={14} color="#64748b" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
