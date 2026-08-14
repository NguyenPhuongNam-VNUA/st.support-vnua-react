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
            backgroundColor: 'rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(8px)',
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: '24px',
          p: 1.5,
          backgroundColor: '#ffffff',
          boxShadow: '0 30px 60px -15px rgba(13, 138, 79, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.95) inset',
          border: '1px solid rgba(13, 138, 79, 0.15)',
        },
      }}
    >
      <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Settings2 className="w-6 h-6 text-[#0d8a4f]" />
          <Box>
            <Typography variant="h6" fontWeight={900} sx={{ color: '#0d8a4f', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
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
          <Typography gutterBottom fontWeight={700} sx={{ color: '#0f172a', fontSize: '0.875rem' }}>
            Độ dài mỗi đoạn (Chunk Size): <span className="text-[#0d8a4f] font-black">{chunkSize} ký tự</span>
          </Typography>
          <Slider
            value={chunkSize}
            min={200}
            max={2000}
            step={100}
            onChange={(_, value) => setChunkSize(value as number)}
            sx={{
              color: '#0d8a4f',
              '& .MuiSlider-thumb': {
                boxShadow: '0 2px 8px rgba(13, 138, 79, 0.4)',
              },
            }}
          />
        </Box>

        <Box mt={3.5}>
          <Typography gutterBottom fontWeight={700} sx={{ color: '#0f172a', fontSize: '0.875rem' }}>
            Độ chồng lặp giữa các đoạn (Chunk Overlap): <span className="text-[#0d8a4f] font-black">{chunkOverlap} ký tự</span>
            <Tooltip title="Giúp giữ ngữ cảnh liền mạch khi chia đoạn">
              <Info className="w-4 h-4 ml-1 inline text-slate-400" />
            </Tooltip>
          </Typography>
          <Slider
            value={chunkOverlap}
            min={0}
            max={1000}
            step={50}
            onChange={(_, value) => setChunkOverlap(value as number)}
            sx={{
              color: '#0d8a4f',
              '& .MuiSlider-thumb': {
                boxShadow: '0 2px 8px rgba(13, 138, 79, 0.4)',
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, gap: 1.5 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: '9999px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 800,
            color: '#475569',
            bgcolor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            '&:hover': { bgcolor: '#f0f8f4', color: '#0d8a4f' },
          }}
        >
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          sx={{
            borderRadius: '9999px',
            px: 3.5,
            py: 1,
            textTransform: 'none',
            fontWeight: 800,
            backgroundColor: '#0d8a4f',
            color: '#ffffff',
            boxShadow: '0 4px 14px -2px rgba(13, 138, 79, 0.35)',
            '&:hover': {
              backgroundColor: '#0a7543',
              boxShadow: '0 6px 18px -2px rgba(13, 138, 79, 0.45)',
            },
          }}
        >
          Xác nhận Embedding
        </Button>
      </DialogActions>
    </Dialog>
  );
}

