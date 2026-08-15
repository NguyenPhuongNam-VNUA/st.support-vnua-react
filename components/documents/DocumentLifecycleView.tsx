'use client';

import React, { useEffect, useState } from 'react';
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
import documentApi from '@/api/admin/documentApi';

export const VALIDITY_OPTIONS = ['Còn hiệu lực', 'Hết hiệu lực', 'Theo học kỳ (HK1 2025-2026)'];

export default function DocumentLifecycleView() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Dialog & Drawer states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [testRetrievalOpen, setTestRetrievalOpen] = useState(false);
  const [chunkInspectorOpen, setChunkInspectorOpen] = useState(false);
  const [selectedDocTitle, setSelectedDocTitle] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      const response: any = await documentApi.getAll({ limit: 100 });
      setDocuments(response?.data?.documents || []);
      setApiError(null);
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể tải danh sách tài liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      const response: any = await documentApi.update(id, { is_active: !isActive });
      setDocuments((prev) => prev.map((doc) => (doc.id === id ? response.data : doc)));
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể cập nhật tài liệu');
    }
  };

  const handlePreview = async (id: number) => {
    try {
      const response: any = await documentApi.getFileUrl(id);
      setPreviewUrl(response?.data?.url || null);
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể mở PDF');
    }
  };

  const handleEmbed = async (id: number) => {
    try {
      const response: any = await documentApi.embed(id);
      setDocuments((prev) => prev.map((doc) => (doc.id === id ? response.data : doc)));
      setApiError(null);
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể khởi chạy pipeline AI');
    }
  };

  const openInspector = (id: number, title: string) => {
    setSelectedDocId(id);
    setSelectedDocTitle(title);
    setChunkInspectorOpen(true);
  };

  return (
    <Box>
      {loading && <Typography mb={2} color="text.secondary">Đang tải tài liệu từ Supabase...</Typography>}
      {apiError && <Typography mb={2} color="error.main" fontWeight={700}>{apiError}</Typography>}
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
                        Ngày tải: {new Date(doc.created_at).toLocaleString('vi-VN')}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Active Toggle */}
                  <Tooltip title={doc.is_active ? 'Đang hoạt động (RAG Agent sử dụng)' : 'Đã lưu trữ (RAG Agent bỏ qua)'}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={doc.is_active}
                          onChange={() => handleToggleActive(doc.id, doc.is_active)}
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
                    label={`Hiệu lực: ${doc.validity || 'Chưa xác định'}`}
                    size="small"
                    sx={{
                      borderRadius: '9999px',
                      fontWeight: 700,
                      fontSize: '0.725rem',
                      backgroundColor: doc.validity?.includes('Hết') ? '#fff1f2' : '#f0f8f4',
                      color: doc.validity?.includes('Hết') ? '#be123c' : '#0d8a4f',
                      border: `1px solid ${doc.validity?.includes('Hết') ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
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
                    onClick={() => handlePreview(doc.id)}
                    sx={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none', color: '#0d8a4f', px: 1.2, '&:hover': { bgcolor: '#f0f8f4' } }}
                  >
                    Xem PDF
                  </Button>

                  <Box display="flex" gap={1}>
                    {doc.pipeline_stage !== 'ready' && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Cpu className="w-4 h-4" />}
                        onClick={() => handleEmbed(doc.id)}
                        disabled={doc.pipeline_stage === 'embedding' || doc.pipeline_stage === 'chunking'}
                        sx={{ borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}
                      >
                        Xử lý AI
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Layers className="w-4 h-4" />}
                      onClick={() => openInspector(doc.id, doc.title)}
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
        documentId={selectedDocId}
        documentTitle={selectedDocTitle}
      />

      <RagTestRetrievalModal
        open={testRetrievalOpen}
        onClose={() => setTestRetrievalOpen(false)}
      />

      <UploadPdfDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSubmit={async (form) => {
          try {
            await documentApi.add(form);
            setUploadOpen(false);
            await loadDocuments();
          } catch (error: any) {
            setApiError(error?.response?.data?.message || 'Không thể tải tài liệu lên');
          }
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
