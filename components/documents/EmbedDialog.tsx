'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
  Typography,
  Box,
  Tooltip,
} from '@mui/material';
import { Info, Settings2 } from 'lucide-react';

export default function EmbedDialog({ open, onClose, onConfirm, defaultValues }: any) {
  const [chunkSize, setChunkSize] = useState(defaultValues?.chunkSize || 1000);
  const [chunkOverlap, setChunkOverlap] = useState(defaultValues?.chunkOverlap || 200);

  const handleConfirm = () => {
    onConfirm({ chunk_size: chunkSize, chunk_overlap: chunkOverlap });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
          <Settings2 className="w-6 h-6 text-[#1f2937]" />
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#1f2937', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
              Chọn tham số Embedding
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Tối ưu kích thước chunk và độ chồng lặp ngữ cảnh cho RAG pipeline
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 1 }}>
        <Box mt={2}>
          <Typography gutterBottom fontWeight={500} sx={{ color: '#1f2937', fontSize: '0.875rem' }}>
            Độ dài mỗi đoạn (Chunk Size): <span className="text-[#1f2937] font-semibold">{chunkSize} ký tự</span>
          </Typography>
          <Slider
            value={chunkSize}
            min={200}
            max={2000}
            step={100}
            onChange={(_, value) => setChunkSize(value as number)}
            sx={{
              color: '#1f2937',
              '& .MuiSlider-thumb': {
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              },
            }}
          />
        </Box>

        <Box mt={3.5}>
          <Typography gutterBottom fontWeight={500} sx={{ color: '#1f2937', fontSize: '0.875rem' }}>
            Độ chồng lặp giữa các đoạn (Chunk Overlap): <span className="text-[#1f2937] font-semibold">{chunkOverlap} ký tự</span>
            <Tooltip title="Giúp giữ ngữ cảnh liền mạch khi chia đoạn">
              <Info className="w-4 h-4 ml-1 inline text-gray-400" />
            </Tooltip>
          </Typography>
          <Slider
            value={chunkOverlap}
            min={0}
            max={1000}
            step={50}
            onChange={(_, value) => setChunkOverlap(value as number)}
            sx={{
              color: '#1f2937',
              '& .MuiSlider-thumb': {
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, gap: 1.5 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: '8px',
            px: 3,
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
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          sx={{
            borderRadius: '8px',
            px: 3.5,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            backgroundColor: '#1f2937',
            color: '#ffffff',
            boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.12)',
            '&:hover': {
              backgroundColor: '#111827',
              boxShadow: '0 6px 18px -2px rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          Xác nhận Embedding
        </Button>
      </DialogActions>
    </Dialog>
  );
}

