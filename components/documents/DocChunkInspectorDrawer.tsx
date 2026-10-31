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
      <Box p={3} bgcolor="#4b5563" color="#ffffff" display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={1.5}>
          <div className="w-9 h-9 rounded-none bg-white/20 text-white flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#ffffff', fontSize: '1.1rem', lineHeight: 1.2 }}>
              Chi tiết Chunks & Vector Embeddings
            </Typography>
            <Typography variant="caption" sx={{ color: '#f3f4f6', fontWeight: 500 }}>
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
        <Box mb={3} p={2} bgcolor="#f8f8f8" border="1px solid #e5e7eb">
          <Typography variant="caption" fontWeight={500} color="text.secondary" display="block">
            TÀI LIỆU ĐANG XEM:
          </Typography>
          <Typography variant="body2" fontWeight={600} color="slate.900" mb={1}>
            {documentTitle || 'Quy chế Đào tạo và Học phí Khoa CNTT.pdf'}
          </Typography>

          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip size="small" label={`Tổng Chunks: ${chunks.length}`} sx={{ borderRadius: 0, fontWeight: 500, backgroundColor: '#f7f7f7', color: '#4b5563' }} />
            <Chip size="small" label="Embedding Model: Gemini Embedding 2" sx={{ borderRadius: 0, fontWeight: 500, backgroundColor: '#f3f4f6' }} />
            <Chip size="small" label="Vector Size: 1024" sx={{ borderRadius: 0, fontWeight: 500, backgroundColor: '#f3f4f6' }} />
          </Box>
        </Box>

        <Typography variant="subtitle2" fontWeight={600} color="slate.900" mb={2}>
          Danh sách đoạn văn bản đã phân tách (Text Chunks):
        </Typography>

        <Box display="flex" flexDirection="column" gap={2}>
          {chunks.map((chunk, index) => (
            <Accordion key={chunk.id} defaultExpanded={index === 0} sx={{ borderRadius: 0, border: '1px solid #d1d5db', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ChevronDown className="w-4 h-4" />} sx={{ backgroundColor: '#f8f8f8' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" pr={1}>
                  <span className="text-xs font-semibold text-[#4b5563]">CHUNK #{index + 1} ({chunk.id})</span>
                  <span className="text-[11px] font-medium text-gray-500">Trang {chunk.page} • {chunk.tokens} tokens</span>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 2, backgroundColor: '#ffffff' }}>
                <Typography variant="caption" fontWeight={500} color="text.secondary" display="block">
                  Văn bản trích xuất:
                </Typography>
                <Typography variant="body2" color="slate.800" p={1.5} bgcolor="#f8f8f8" border="1px solid #e5e7eb" mb={1.5}>
                  {chunk.content}
                </Typography>

                <Typography variant="caption" fontWeight={500} color="text.secondary" display="block">
                  Mẫu Vector Float32 Array Preview:
                </Typography>
                <Box p={1} bgcolor="#1f2937" color="#9ca3af" fontFamily="monospace" fontSize="0.725rem" border="1px solid #1f2937">
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

      <Box p={2} borderTop="1px solid #e5e7eb" bgcolor="#f8f8f8" display="flex" justifyContent="flex-end">
        <Button onClick={onClose} variant="contained" sx={{ borderRadius: 0, backgroundColor: '#4b5563', fontWeight: 500, textTransform: 'none' }}>
          Đóng cửa sổ
        </Button>
      </Box>
    </Drawer>
  );
}
