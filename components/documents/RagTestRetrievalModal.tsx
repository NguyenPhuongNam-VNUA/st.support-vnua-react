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
import { Search, Sparkles, FileText, CheckCircle2, Sliders } from 'lucide-react';

interface RagTestRetrievalModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RagTestRetrievalModal({ open, onClose }: RagTestRetrievalModalProps) {
  const [query, setQuery] = useState('Mức học phí tín chỉ ngành Công nghệ thông tin năm 2025?');
  const [topK, setTopK] = useState(3);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const handleTestSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setResults([
        {
          id: 1,
          score: 94.8,
          document: 'Quy chế Đào tạo và Học phí Khoa CNTT.pdf',
          version: 'v2.1 (Active)',
          chunk:
            'Học phí ngành Công nghệ thông tin áp dụng cho khóa tuyển sinh 2025 là 450.000đ/tín chỉ đối với các học phần đại cương và 520.000đ/tín chỉ đối với học phần chuyên ngành.',
        },
        {
          id: 2,
          score: 82.3,
          document: 'Thông báo Tuyển sinh ĐH Chính quy 2025.pdf',
          version: 'v1.0 (Active)',
          chunk:
            'Mức thu học phí tạm thu đầu khóa cho sinh viên K70 ngành CNTT là 5.000.000đ cho kỳ học đầu tiên.',
        },
      ]);
      setIsSearching(false);
    }, 600);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 0,
          p: 1,
          border: '1px solid #cbd5e1',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', fontSize: '1.15rem', lineHeight: 1.2 }}>
              Thử nghiệm Semantic Retrieval RAG (Test Query)
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Nhập câu hỏi mẫu để kiểm tra các Chunk context nào được RAG Agent truy xuất trước khi public
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2 }}>
        <Box display="flex" gap={2} mb={3}>
          <TextField
            fullWidth
            size="small"
            label="Câu hỏi mẫu cần test RAG retrieval"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          />

          <FormControl size="small" sx={{ width: 140 }}>
            <Select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              sx={{ borderRadius: 0 }}
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
            sx={{
              borderRadius: 0,
              backgroundColor: '#2563eb',
              fontWeight: 700,
              px: 3,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              minWidth: 'auto',
            }}
          >
            Chạy thử
          </Button>
        </Box>

        {isSearching && <LinearProgress sx={{ my: 2 }} />}

        {results && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Typography variant="subtitle2" fontWeight={800} color="slate.900">
              Kết quả Trích xuất Context Chunks ({results.length} đoạn tương đồng nhất):
            </Typography>

            {results.map((res, i) => (
              <Box key={res.id} p={2} border="1px solid #cbd5e1" bgcolor="#f8fafc">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <span className="text-xs font-black text-white bg-[#2563eb] px-2 py-0.5">#{i + 1}</span>
                    <span className="text-xs font-bold text-slate-800">{res.document}</span>
                    <Chip size="small" label={res.version} sx={{ borderRadius: 0, fontSize: '0.675rem', fontWeight: 700 }} />
                  </Box>
                  <Chip
                    size="small"
                    label={`${res.score}% Cosine Match`}
                    sx={{
                      borderRadius: '9999px',
                      fontWeight: 800,
                      fontSize: '0.725rem',
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      border: 'none',
                    }}
                  />
                </Box>
                <Typography variant="body2" color="slate.900" p={1.5} bgcolor="#ffffff" border="1px solid #e2e8f0">
                  &quot;{res.chunk}&quot;
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 700 }}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
