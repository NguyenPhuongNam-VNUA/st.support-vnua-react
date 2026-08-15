'use client';

import React, { useEffect, useState } from 'react';
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
import documentApi from '@/api/admin/documentApi';

interface DocChunkInspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  documentId: number | null;
  documentTitle: string;
}

export default function DocChunkInspectorDrawer({
  open,
  onClose,
  documentId,
  documentTitle,
}: DocChunkInspectorDrawerProps) {
  const [chunks, setChunks] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !documentId) return;
    documentApi
      .getChunks(documentId)
      .then((response: any) => setChunks(response?.data?.chunks || []))
      .catch(() => setChunks([]));
  }, [open, documentId]);

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
            <Chip size="small" label={`Tổng Chunks: ${chunks.length}`} sx={{ borderRadius: 0, fontWeight: 700, backgroundColor: '#edf4fc', color: '#2563eb' }} />
            <Chip size="small" label="Embedding Model: cấu hình bởi AI Agent" sx={{ borderRadius: 0, fontWeight: 700, backgroundColor: '#f1f5f9' }} />
            <Chip size="small" label="Vector Size: 1024" sx={{ borderRadius: 0, fontWeight: 700, backgroundColor: '#f1f5f9' }} />
          </Box>
        </Box>

        <Typography variant="subtitle2" fontWeight={800} color="slate.900" mb={2}>
          Danh sách đoạn văn bản đã phân tách (Text Chunks):
        </Typography>

        <Box display="flex" flexDirection="column" gap={2}>
          {chunks.map((chunk, index) => (
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
                  Embedding được lưu an toàn trong PostgreSQL và không trả toàn bộ vector về trình duyệt.
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
          {chunks.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Tài liệu chưa có chunk hoặc pipeline embedding chưa hoàn tất.
            </Typography>
          )}
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
