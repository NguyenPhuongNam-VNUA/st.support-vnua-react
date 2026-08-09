'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
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
  Trash2,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Tag,
  Search,
} from 'lucide-react';
import DocChunkInspectorDrawer from './DocChunkInspectorDrawer';
import RagTestRetrievalModal from './RagTestRetrievalModal';
import UploadPdfDialog from './UploadPdfDialog';
import EmbedDialog from './EmbedDialog';
import DialogPreview from './DialogPreview';
import ConfirmDialog from '../DialogConfirm';

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
    setQuestionsOrDocs((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, is_active: !doc.is_active } : doc))
    );
  };

  const setQuestionsOrDocs = setDocuments;

  const openInspector = (title: string) => {
    setSelectedDocTitle(title);
    setChunkInspectorOpen(true);
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.02em' }}>
            Thư viện Tài liệu & Vòng đời RAG Knowledge Base
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Quản lý pipeline xử lý tài liệu (Upload → Chunking → Embedding → Active), Versioning và Test Search
          </Typography>
        </Box>

        <Box display="flex" gap={1.5}>
          <Button
            variant="outlined"
            startIcon={<Sparkles className="w-4 h-4" />}
            onClick={() => setTestRetrievalOpen(true)}
            sx={{ borderRadius: '8px', fontWeight: 700, textTransform: 'none', borderColor: '#2563eb', color: '#2563eb' }}
          >
            Thử nghiệm RAG Retrieval
          </Button>

          <Button
            variant="contained"
            startIcon={<Upload className="w-4 h-4" />}
            onClick={() => setUploadOpen(true)}
            sx={{ borderRadius: '8px', backgroundColor: '#2563eb', fontWeight: 700, textTransform: 'none' }}
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
                sx={{
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                  border: '1px solid #e2e8f0',
                  p: 2.5,
                  position: 'relative',
                  backgroundColor: doc.is_active ? '#ffffff' : '#f8fafc',
                  opacity: doc.is_active ? 1 : 0.8,
                }}
              >
                {/* Top Row: File icon + Title + Version + Active Toggle */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box display="flex" gap={1.5} alignItems="center">
                    <FileText className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1" fontWeight={800} color="slate.900" sx={{ lineHeight: 1.2 }}>
                          {doc.title}
                        </Typography>
                        <Chip label={doc.version} size="small" sx={{ borderRadius: '9999px', fontWeight: 800, fontSize: '0.7rem' }} />
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
                          color="primary"
                          size="small"
                        />
                      }
                      label={<span className="text-[11px] font-extrabold">{doc.is_active ? 'ACTIVE' : 'OFF'}</span>}
                      sx={{ m: 0 }}
                    />
                  </Tooltip>
                </Box>

                <Typography variant="body2" color="slate.700" mb={2} sx={{ fontSize: '0.85rem' }}>
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
                      backgroundColor: doc.validity.includes('Còn') ? '#ecfdf5' : doc.validity.includes('Hết') ? '#fff1f2' : '#eff6ff',
                      color: doc.validity.includes('Còn') ? '#047857' : doc.validity.includes('Hết') ? '#be123c' : '#1d4ed8',
                      border: 'none',
                    }}
                  />

                  {/* Pipeline Stage Badge */}
                  <span className="text-xs font-bold flex items-center gap-1">
                    {doc.pipeline_stage === 'ready' && <span className="text-emerald-700 font-extrabold flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sẵn sàng RAG</span>}
                    {doc.pipeline_stage === 'embedding' && <span className="text-blue-700 font-extrabold flex items-center gap-1"><Cpu className="w-4 h-4 text-blue-600 animate-spin" /> Đang embedding ({doc.progress}%)</span>}
                  </span>
                </Box>

                {/* Progress bar if processing */}
                {isProcessing && (
                  <Box mb={2}>
                    <LinearProgress variant="determinate" value={doc.progress} sx={{ height: 6, borderRadius: '9999px' }} />
                  </Box>
                )}

                <Divider sx={{ my: 1.5 }} />

                {/* Footer Buttons */}
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<Eye className="w-4 h-4" />}
                    onClick={() => setPreviewUrl(doc.file_path)}
                    sx={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none', color: '#2563eb', px: 1, '&:hover': { bgcolor: '#eff6ff' } }}
                  >
                    Xem PDF
                  </Button>

                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Layers className="w-4 h-4" />}
                      onClick={() => openInspector(doc.title)}
                      sx={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none', backgroundColor: '#2563eb' }}
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
