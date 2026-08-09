'use client';

import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
} from '@mui/material';
import { X, Cpu, ChevronDown, Layers, FileText, Code2, Sparkles } from 'lucide-react';

interface DocChunkInspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  documentTitle: string;
}

export default function DocChunkInspectorDrawer({
  open,
  onClose,
  documentTitle,
}: DocChunkInspectorDrawerProps) {
  // Mock extracted chunks with 768-dim vector preview
  const MOCK_CHUNKS = [
    {
      id: 'chunk_001',
      page: 1,
      tokens: 245,
      content:
        'Học phí ngành Công nghệ thông tin áp dụng cho khóa tuyển sinh 2025 là 450.000đ/tín chỉ đối với các học phần đại cương và 520.000đ/tín chỉ đối với học phần chuyên ngành.',
      vector_preview: '[0.0241, -0.1582, 0.8912, 0.0041, -0.3129, 0.4412, ... 768 dimensions]',
    },
    {
      id: 'chunk_002',
      page: 2,
      tokens: 310,
      content:
        'Sinh viên có hoàn cảnh khó khăn hoặc thuộc diện chính sách được giảm 50% đến 100% học phí theo quy định chung của Học viện Nông nghiệp Việt Nam.',
      vector_preview: '[-0.1042, 0.3341, 0.1198, -0.7781, 0.5120, 0.0912, ... 768 dimensions]',
    },
    {
      id: 'chunk_003',
      page: 3,
      tokens: 180,
      content:
        'Thời gian hoàn thành nghĩa vụ đóng học phí đợt 1 năm học 2025-2026 muộn nhất là ngày 30/09/2025.',
      vector_preview: '[0.4410, -0.0912, 0.6512, 0.1239, -0.0091, 0.2319, ... 768 dimensions]',
    },
  ];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 600 },
          p: 0,
          borderRadius: 0,
        },
      }}
    >
      {/* Header */}
      <Box p={3} bgcolor="#2563eb" color="#ffffff" display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={1.5}>
          <div className="w-9 h-9 rounded-none bg-white/20 text-white flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#ffffff', fontSize: '1.1rem', lineHeight: 1.2 }}>
              Chi tiết Chunks & Vector Embeddings
            </Typography>
            <Typography variant="caption" sx={{ color: '#dbeafe', fontWeight: 500 }}>
              Công cụ Debug Context Retriever cho RAG Pipeline
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#ffffff' }}>
          <X className="w-5 h-5" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box p={3} flex={1} overflow="auto">
        <Box mb={3} p={2} bgcolor="#f8fafc" border="1px solid #e2e8f0">
          <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
            TÀI LIỆU ĐANG XEM:
          </Typography>
          <Typography variant="body2" fontWeight={800} color="slate.900" mb={1}>
            {documentTitle || 'Quy chế Đào tạo và Học phí Khoa CNTT.pdf'}
          </Typography>

          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip size="small" label="Tổng Chunks: 3" sx={{ borderRadius: 0, fontWeight: 700, backgroundColor: '#edf4fc', color: '#2563eb' }} />
            <Chip size="small" label="Embedding Model: text-embedding-004" sx={{ borderRadius: 0, fontWeight: 700, backgroundColor: '#f1f5f9' }} />
            <Chip size="small" label="Vector Size: 768 Float32" sx={{ borderRadius: 0, fontWeight: 700, backgroundColor: '#f1f5f9' }} />
          </Box>
        </Box>

        <Typography variant="subtitle2" fontWeight={800} color="slate.900" mb={2}>
          Danh sách đoạn văn bản đã phân tách (Text Chunks):
        </Typography>

        <Box display="flex" flexDirection="column" gap={2}>
          {MOCK_CHUNKS.map((chunk, index) => (
            <Accordion key={chunk.id} defaultExpanded={index === 0} sx={{ borderRadius: 0, border: '1px solid #cbd5e1', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ChevronDown className="w-4 h-4" />} sx={{ backgroundColor: '#f8fafc' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" pr={1}>
                  <span className="text-xs font-black text-[#2563eb]">CHUNK #{index + 1} ({chunk.id})</span>
                  <span className="text-[11px] font-bold text-slate-500">Trang {chunk.page} • {chunk.tokens} tokens</span>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 2, backgroundColor: '#ffffff' }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                  Văn bản trích xuất:
                </Typography>
                <Typography variant="body2" color="slate.800" p={1.5} bgcolor="#f8fafc" border="1px solid #e2e8f0" mb={1.5}>
                  {chunk.content}
                </Typography>

                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                  Mẫu Vector Float32 Array Preview:
                </Typography>
                <Box p={1} bgcolor="#0f172a" color="#38bdf8" fontFamily="monospace" fontSize="0.725rem" border="1px solid #1e293b">
                  {chunk.vector_preview}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Box>

      <Box p={2} borderTop="1px solid #e2e8f0" bgcolor="#f8fafc" display="flex" justifyContent="flex-end">
        <Button onClick={onClose} variant="contained" sx={{ borderRadius: 0, backgroundColor: '#2563eb', fontWeight: 700, textTransform: 'none' }}>
          Đóng cửa sổ
        </Button>
      </Box>
    </Drawer>
  );
}
