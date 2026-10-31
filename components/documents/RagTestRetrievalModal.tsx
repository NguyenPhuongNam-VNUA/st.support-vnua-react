'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  Chip,
  LinearProgress,
} from '@mui/material';
import { Search, Sparkles } from 'lucide-react';
import documentApi from '@/api/admin/documentApi';

interface RagTestRetrievalModalProps {
  open: boolean;
  onClose: () => void;
}

interface RetrievalResult {
  source_type: 'document' | 'faq' | string;
  document_id: number | null;
  title: string | null;
  page: number | null;
  page_end: number | null;
  chunk_index: number | null;
  version: string | null;
  validity_status: string | null;
  snippet: string;
  final_score: number | null;
}

interface RetrievalMeta {
  embedding_ready: boolean;
  rerank_strategy: string | null;
  degraded: boolean;
  latency_ms: number;
}

const formatScore = (score: number | null) =>
  score == null ? 'N/A' : `${(Math.max(0, Math.min(1, score)) * 100).toFixed(1)}%`;

export default function RagTestRetrievalModal({ open, onClose }: RagTestRetrievalModalProps) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(3);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<RetrievalResult[] | null>(null);
  const [meta, setMeta] = useState<RetrievalMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestSearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || isSearching) return;
    setIsSearching(true);
    setError(null);
    try {
      const res: any = await documentApi.testRetrieval(trimmed, topK);
      const data = res?.data || {};
      setResults(Array.isArray(data.results) ? data.results : []);
      setMeta({
        embedding_ready: Boolean(data.embedding_ready),
        rerank_strategy: data.rerank_strategy ?? null,
        degraded: Boolean(data.degraded),
        latency_ms: Number(data.latency_ms) || 0,
      });
    } catch (err: any) {
      setResults(null);
      setMeta(null);
      setError(err?.message || 'Không thể chạy thử truy xuất');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(8px)',
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: '12px',
          p: 1.5,
          backgroundColor: '#ffffff',
          boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.95) inset',
          border: '1px solid rgba(0, 0, 0, 0.12)',
        },
      }}
    >
      <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Sparkles className="w-6 h-6 text-[#1f2937]" />
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#1f2937', fontSize: '1.25rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Thử nghiệm Semantic Retrieval RAG (Test Query)
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Nhập câu hỏi mẫu để kiểm tra các Chunk context nào được RAG Agent truy xuất trước khi public
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 1 }}>
        <Box display="flex" gap={1.5} mb={3} mt={1} flexWrap={{ xs: 'wrap', sm: 'nowrap' }}>
          <TextField
            fullWidth
            size="small"
            label="Câu hỏi mẫu cần test RAG retrieval"
            placeholder="VD: Mức học phí tín chỉ ngành Công nghệ thông tin?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleTestSearch();
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: '#f8f8f8',
                '&.Mui-focused fieldset': { borderColor: '#1f2937' },
              },
            }}
          />

          <FormControl size="small" sx={{ width: { xs: '100%', sm: 130 } }}>
            <Select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              sx={{
                borderRadius: '12px',
                bgcolor: '#f8f8f8',
                '&.Mui-focused fieldset': { borderColor: '#1f2937' },
              }}
            >
              <MenuItem value={1}>Top K = 1</MenuItem>
              <MenuItem value={3}>Top K = 3</MenuItem>
              <MenuItem value={5}>Top K = 5</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<Search className="w-4 h-4" />}
            onClick={handleTestSearch}
            disabled={isSearching || query.trim().length < 2}
            sx={{
              borderRadius: '8px',
              backgroundColor: '#1f2937',
              color: '#ffffff',
              fontWeight: 600,
              px: 3,
              py: 1,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              minWidth: 'auto',
              boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.12)',
              '&:hover': {
                backgroundColor: '#111827',
                boxShadow: '0 6px 18px -2px rgba(0, 0, 0, 0.12)',
              },
            }}
          >
            Chạy thử
          </Button>
        </Box>

        {isSearching && (
          <LinearProgress
            sx={{
              my: 2.5,
              height: 6,
              borderRadius: '8px',
              bgcolor: 'rgba(0, 0, 0, 0.08)',
              '& .MuiLinearProgress-bar': { bgcolor: '#1f2937', borderRadius: '8px' },
            }}
          />
        )}

        {error && (
          <Typography role="alert" variant="body2" fontWeight={500} sx={{ color: '#b91c1c', mb: 2 }}>
            {error}
          </Typography>
        )}

        {results && (
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#1f2937', fontSize: '0.875rem' }}>
              Kết quả Trích xuất Context Chunks ({results.length} đoạn tương đồng nhất):
            </Typography>
            {meta && (
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                {meta.latency_ms} ms · Embedding: {meta.embedding_ready ? 'có' : 'không (chỉ BM25)'} · Rerank:{' '}
                {meta.rerank_strategy || 'N/A'}
                {meta.degraded ? ' · Chế độ dự phòng' : ''}
              </Typography>
            )}
            {results.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Không tìm thấy đoạn tài liệu hoặc câu hỏi nào phù hợp trong kho tri thức.
              </Typography>
            )}

            {results.map((res, i) => (
              <Box
                key={`${res.source_type}-${res.document_id ?? 'faq'}-${res.chunk_index ?? i}`}
                p={2.5}
                borderRadius="18px"
                border="1px solid rgba(0, 0, 0, 0.12)"
                bgcolor="#f8f8f8"
                boxShadow="0 2px 8px -2px rgba(0, 0, 0, 0.04)"
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                  <Box display="flex" alignItems="center" gap={1.2}>
                    <span className="text-xs font-semibold text-white bg-[#1f2937] px-2 py-0.5 rounded-md">
                      #{i + 1}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">
                      {res.title || (res.source_type === 'faq' ? 'Ngân hàng câu hỏi' : 'Tài liệu')}
                      {res.page != null && ` · tr. ${res.page}${res.page_end && res.page_end !== res.page ? `-${res.page_end}` : ''}`}
                    </span>
                    <Chip
                      size="small"
                      label={
                        res.source_type === 'faq'
                          ? 'FAQ'
                          : [res.version, res.validity_status].filter(Boolean).join(' · ') || 'Tài liệu'
                      }
                      sx={{
                        borderRadius: '8px',
                        fontSize: '0.675rem',
                        fontWeight: 600,
                        bgcolor: '#f3f4f6',
                        color: '#1f2937',
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                      }}
                    />
                  </Box>
                  <Chip
                    size="small"
                    label={`Điểm ${formatScore(res.final_score)}`}
                    sx={{
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.725rem',
                      backgroundColor: '#f3f4f6',
                      color: '#1f2937',
                      border: '1px solid #e5e7eb',
                    }}
                  />
                </Box>
                <Typography
                  variant="body2"
                  color="slate.800"
                  p={2}
                  borderRadius="12px"
                  bgcolor="#ffffff"
                  border="1px solid rgba(0, 0, 0, 0.08)"
                  sx={{ lineHeight: 1.6, fontWeight: 500, fontSize: '0.85rem' }}
                >
                  &quot;{res.snippet}&quot;
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: '8px',
            px: 3.5,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            color: '#4b5563',
            bgcolor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            '&:hover': { bgcolor: '#f3f4f6', color: '#1f2937' },
          }}
        >
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}

