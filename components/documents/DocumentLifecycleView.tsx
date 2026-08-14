'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Chip,
  Tooltip,
  Divider,
  LinearProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  FileText,
  Upload,
  Eye,
  Layers,
  Sparkles,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { LibraryShelfIcon } from '@/components/icons/SidebarIcons';
import DocChunkInspectorDrawer from './DocChunkInspectorDrawer';
import RagTestRetrievalModal from './RagTestRetrievalModal';
import UploadPdfDialog from './UploadPdfDialog';
import DialogPreview from './DialogPreview';

export const VALIDITY_OPTIONS = ['Còn hiệu lực', 'Hết hiệu lực', 'Theo học kỳ (HK1 2025-2026)'];

export default function DocumentLifecycleView() {
  const [documents, setDocuments] = useState<any[]>([
    {
      id: 1,
      title: 'Quy chế Đào tạo và Học phí Khoa CNTT.pdf',
      description: 'Tải lên quy định tín chỉ, học bổng và học phí cập nhật năm học 2025-2026',
      version: 'v2.1',
      is_active: true,
      validity: 'Còn hiệu lực',
      pipeline_stage: 'ready', // 'uploading' | 'chunking' | 'embedding' | 'ready' | 'error'
      progress: 100,
      file_path: 'storage/documents/hocphi.pdf',
      created_at: '09/08/2026 09:00',
    },
    {
      id: 2,
      title: 'Thông báo Tuyển sinh ĐH Chính quy 2025.pdf',
      description: 'Chỉ tiêu tuyển sinh và danh sách các phương thức xét tuyển mới',
      version: 'v1.0',
      is_active: true,
      validity: 'Còn hiệu lực',
      pipeline_stage: 'ready',
      progress: 100,
      file_path: 'storage/documents/tuyensinh.pdf',
      created_at: '08/08/2026 14:15',
    },
    {
      id: 3,
      title: 'Quy định Ký túc xá và Tạm trú năm 2024 (Cũ).pdf',
      description: 'Văn bản quy định cũ của năm 2024 đã được thay thế',
      version: 'v1.0',
      is_active: false, // Archived version!
      validity: 'Hết hiệu lực',
      pipeline_stage: 'ready',
      progress: 100,
      file_path: 'storage/documents/ktx2024.pdf',
      created_at: '01/01/2024 08:00',
    },
    {
      id: 4,
      title: 'Hướng dẫn Đăng ký Đồ án Tốt nghiệp HK1 2025-2026.pdf',
      description: 'Tài liệu hướng dẫn điều kiện và quy trình nộp đề tài đồ án',
      version: 'v1.0',
      is_active: true,
      validity: 'Theo học kỳ (HK1 2025-2026)',
      pipeline_stage: 'embedding', // Currently embedding!
      progress: 65,
      file_path: 'storage/documents/doan.pdf',
      created_at: '09/08/2026 14:00',
    },
  ]);

  // Dialog & Drawer states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [testRetrievalOpen, setTestRetrievalOpen] = useState(false);
  const [chunkInspectorOpen, setChunkInspectorOpen] = useState(false);
  const [selectedDocTitle, setSelectedDocTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleToggleActive = (id: number) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, is_active: !doc.is_active } : doc))
    );
  };

  const openInspector = (title: string) => {
    setSelectedDocTitle(title);
    setChunkInspectorOpen(true);
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3.5} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          {/* Custom SVG Icon Placed Directly without Div Wrapper */}
          <LibraryShelfIcon size={42} className="text-[#0d8a4f] flex-shrink-0 transition-transform hover:scale-105" />
          <Box>
            <Typography variant="h5" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.02em', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
              Thư Viện Tài Liệu & Vòng Đời RAG Knowledge Base
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Quản lý pipeline xử lý tài liệu (Upload → Chunking → Embedding → Active), Versioning và Test Search
            </Typography>
          </Box>
        </Box>

        <Box display="flex" gap={1.5} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<Sparkles className="w-4 h-4" />}
            onClick={() => setTestRetrievalOpen(true)}
            sx={{ 
              borderRadius: '9999px', 
              fontWeight: 800, 
              textTransform: 'none', 
              border: '1.5px solid rgba(13, 138, 79, 0.28)', 
              color: '#0d8a4f',
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 8px rgba(13, 138, 79, 0.08)',
              px: 2.2,
              py: 0.8,
              '&:hover': { bgcolor: '#f0f8f4', borderColor: '#0d8a4f', transform: 'translateY(-1px)' }
            }}
          >
            Thử nghiệm RAG Retrieval
          </Button>

          <Button
            variant="contained"
            startIcon={<Upload className="w-4 h-4" />}
            onClick={() => setUploadOpen(true)}
            sx={{ 
              borderRadius: '9999px', 
              backgroundColor: '#0d8a4f', 
              color: '#ffffff',
              fontWeight: 800, 
              textTransform: 'none', 
              px: 2.8,
              py: 0.8,
              boxShadow: '0 4px 14px -2px rgba(13, 138, 79, 0.35)',
              '&:hover': { backgroundColor: '#0a7543', transform: 'translateY(-1px)' }
            }}
          >
            Tải lên tài liệu PDF mới
          </Button>
        </Box>
      </Box>

      {/* Document Grid */}
      <Grid container spacing={3}>
        {documents.map((doc) => {
          const isProcessing = doc.pipeline_stage === 'chunking' || doc.pipeline_stage === 'embedding';
          return (
            <Grid key={doc.id} size={{ xs: 12, md: 6, lg: 6 }}>
              <Card
                className="emerald-card"
                sx={{
                  p: 2.8,
                  position: 'relative',
                  backgroundColor: doc.is_active ? '#ffffff' : '#fafdfb',
                  opacity: doc.is_active ? 1 : 0.88,
                  borderColor: doc.is_active ? 'rgba(13, 138, 79, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.9) inset, 0 2px 8px -2px rgba(13, 138, 79, 0.03)',
                }}
              >
                {/* Top Row: File icon + Title + Version + Active Toggle */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box display="flex" gap={1.5} alignItems="center">
                    <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100/80 flex items-center justify-center text-rose-600 flex-shrink-0 shadow-2xs">
                      <FileText className="w-5 h-5" />
                    </div>
                    <Box>
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="subtitle1" fontWeight={800} color="#0f291e" sx={{ lineHeight: 1.2 }}>
                          {doc.title}
                        </Typography>
                        <Chip label={doc.version} size="small" sx={{ borderRadius: '9999px', fontWeight: 800, fontSize: '0.7rem', bgcolor: '#f0f8f4', color: '#0d8a4f', border: '1px solid rgba(16, 185, 129, 0.25)' }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        Ngày tải: {doc.created_at}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Active Toggle */}
                  <Tooltip title={doc.is_active ? 'Đang hoạt động (RAG Agent sử dụng)' : 'Đã lưu trữ (RAG Agent bỏ qua)'}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={doc.is_active}
                          onChange={() => handleToggleActive(doc.id)}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#0d8a4f',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#10b981',
                            },
                          }}
                        />
                      }
                      label={<span className="text-[11px] font-black text-slate-700">{doc.is_active ? 'ACTIVE' : 'OFF'}</span>}
                      sx={{ m: 0 }}
                    />
                  </Tooltip>
                </Box>

                <Typography variant="body2" color="slate.700" mb={2} sx={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {doc.description}
                </Typography>

                {/* Validity Label & Pipeline Stage */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
                  <Chip
                    label={`Hiệu lực: ${doc.validity}`}
                    size="small"
                    sx={{
                      borderRadius: '9999px',
                      fontWeight: 700,
                      fontSize: '0.725rem',
                      backgroundColor: doc.validity.includes('Còn') ? '#f0f8f4' : doc.validity.includes('Hết') ? '#fff1f2' : '#f0f8f4',
                      color: doc.validity.includes('Còn') ? '#0d8a4f' : doc.validity.includes('Hết') ? '#be123c' : '#0d8a4f',
                      border: `1px solid ${doc.validity.includes('Còn') ? 'rgba(16, 185, 129, 0.25)' : doc.validity.includes('Hết') ? 'rgba(244, 63, 94, 0.25)' : 'rgba(13, 138, 79, 0.2)'}`,
                    }}
                  />

                  {/* Pipeline Stage Badge */}
                  <span className="text-xs font-bold flex items-center gap-1">
                    {doc.pipeline_stage === 'ready' && <span className="text-emerald-700 font-black flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-[#10b981]" /> Sẵn sàng RAG</span>}
                    {doc.pipeline_stage === 'embedding' && <span className="text-[#0d8a4f] font-black flex items-center gap-1"><Cpu className="w-4 h-4 text-[#10b981] animate-spin" /> Đang embedding ({doc.progress}%)</span>}
                  </span>
                </Box>

                {/* Progress bar if processing */}
                {isProcessing && (
                  <Box mb={2}>
                    <LinearProgress 
                      variant="determinate" 
                      value={doc.progress} 
                      sx={{ 
                        height: 6, 
                        borderRadius: '9999px',
                        bgcolor: 'rgba(13, 138, 79, 0.05)',
                        '& .MuiLinearProgress-bar': { bgcolor: '#0d8a4f', borderRadius: '9999px' }
                      }} 
                    />
                  </Box>
                )}

                <Divider sx={{ my: 1.5, borderColor: 'rgba(13, 138, 79, 0.06)' }} />

                {/* Footer Buttons */}
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<Eye className="w-4 h-4" />}
                    onClick={() => setPreviewUrl(doc.file_path)}
                    sx={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none', color: '#0d8a4f', px: 1.2, '&:hover': { bgcolor: '#f0f8f4' } }}
                  >
                    Xem PDF
                  </Button>

                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Layers className="w-4 h-4" />}
                      onClick={() => openInspector(doc.title)}
                      sx={{ 
                        borderRadius: '10px', 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        textTransform: 'none', 
                        backgroundColor: '#0d8a4f',
                        px: 1.8,
                        boxShadow: '0 2px 8px rgba(13, 138, 79, 0.2)',
                        '&:hover': { backgroundColor: '#0a7543' }
                      }}
                    >
                      Xem Chunks & Vector
                    </Button>
                  </Box>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Drawers and Dialog Modals */}
      <DocChunkInspectorDrawer
        open={chunkInspectorOpen}
        onClose={() => setChunkInspectorOpen(false)}
        documentTitle={selectedDocTitle}
      />

      <RagTestRetrievalModal
        open={testRetrievalOpen}
        onClose={() => setTestRetrievalOpen(false)}
      />

      <UploadPdfDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSubmit={(form) => {
          console.log('Upload form submitted:', form);
          setUploadOpen(false);
        }}
      />

      <DialogPreview
        open={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        filePath={previewUrl}
      />
    </Box>
  );
}

