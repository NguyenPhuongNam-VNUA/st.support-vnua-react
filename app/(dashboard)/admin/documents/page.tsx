'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  Box, Card, Typography, Button, Divider,
  IconButton, Tooltip, Chip,
  Backdrop, CircularProgress
} from '@mui/material';
import Grid from '@mui/material/Grid2';

import { Upload, Eye, FileText, Trash2, Cpu } from 'lucide-react';

import ConfirmDialog from '@/components/DialogConfirm';
import documentApi from '@/api/admin/documentApi';
import DialogPreview from '@/components/documents/DialogPreview';
import UploadPdfDialog from '@/components/documents/UploadPdfDialog';
import EmbedDialog from '@/components/documents/EmbedDialog';

export default function DocumentLibraryPage() {
    const [openDialog, setOpenDialog] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<any>(null);
    const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
    const [selectedFilePath, setSelectedFilePath] = useState('');
    const [isEmbedding, setIsEmbedding] = useState(false);

    const fetchDocuments = async () => {
        try {
            const res: any = await documentApi.getAll();
            setDocuments(res.data || []);
        } catch (err) {
            console.error('Lỗi khi tải danh sách tài liệu:', err);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handlePreview = (filePath: string) => {
        const apiPath = filePath.replace('storage/', '');
        setPreviewUrl(`${process.env.NEXT_PUBLIC_LARAVEL_API_BASE_URL || ''}/pdf-view?path=${apiPath}`);
    };   

    const handleSubmitUpload = async (formData: any) => {
        try {
          await documentApi.add(formData);
          setOpenDialog(false);
          fetchDocuments();
        } catch (error) {
          console.error('Lỗi khi upload:', error);
        }
    };

    const openEmbedDialog = (filePath: string) => {
        setSelectedFilePath(filePath);
        setEmbedDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!docToDelete) return;
        try {
          await documentApi.delete(docToDelete.id);
          setDeleteConfirmOpen(false);
          setDocToDelete(null);
          fetchDocuments();
        } catch (error) {
          console.error('Lỗi khi xoá tài liệu:', error);
        }
    };
    
    const handleEmbedWithParams = async ({ chunk_size, chunk_overlap }: any) => {
        try {
            setIsEmbedding(true);
            const token = localStorage.getItem('token');
            const apiPath = selectedFilePath.replace('storage/', '');
            await documentApi.embed({ 
                file_path: apiPath, 
                chunk_size, 
                chunk_overlap,
                token
            });
            fetchDocuments();
        } catch (error) {
            console.error('Lỗi khi embed tài liệu:', error);
        } finally {
            setIsEmbedding(false);
            setEmbedDialogOpen(false);
            setSelectedFilePath('');
        }
    };

    return (
        <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
            <Typography variant="h6">Thư viện tài liệu PDF</Typography>
            <Button variant="contained" startIcon={<Upload className="w-5 h-5" />} onClick={() => setOpenDialog(true)}>
            Tải lên tài liệu
            </Button>
        </Box>

        <Grid container spacing={2}>
            {documents.map((doc) => (
                <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card sx={{ p: 2 }}>
                    <Box display="flex" gap={2} alignItems="center">
                        <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
                        <Box>
                            <Typography fontWeight={600}>{doc.title}</Typography>
                            <Typography variant="body2" color="text.secondary">{doc.description}</Typography>
                            <Typography variant="caption" color="text.secondary">{doc.file_type?.toUpperCase()} - {dayjs(doc.created_at).format('DD/MM/YYYY HH:mm:ss')}</Typography>
                            <Box display="flex" alignItems="center" gap={1} mt={1}>
                            {doc.is_embed ? (
                                <Chip
                                    size="small"
                                    label="Đã xử lý dữ liệu"
                                    color="success"
                                    variant="outlined"
                                />
                            ) : (
                                <Chip
                                    size="small"
                                    label="Chưa xử lý dữ liệu"
                                    color="default"
                                    variant="outlined"
                                />
                            )}
                            </Box>
                        </Box>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box display="flex" justifyContent="space-between" mt={1} gap={3}>
                        <Button variant="outlined" onClick={() => handlePreview(doc.file_path) } size="small" startIcon={<Eye className="w-4 h-4" />}>Xem trước</Button>
                        <div>
                            { doc.is_embed ? <></> :
                                (
                                    <Tooltip title="Embed tài liệu vào hệ thống">
                                    <IconButton size='small' onClick={() => openEmbedDialog(doc.file_path)}>
                                        <Cpu className="w-5 h-5 text-indigo-600" />
                                    </IconButton>
                                </Tooltip>
                                ) 
                            }
                            
                            <Tooltip title="Xóa tài liệu">
                                <IconButton 
                                    size="small" 
                                    onClick={() => {
                                        setDocToDelete(doc);
                                        setDeleteConfirmOpen(true);
                                    }}
                                >
                                    <Trash2 className="w-5 h-5 text-red-500" />
                                </IconButton>
                            </Tooltip>
                        </div>
                        
                    </Box>
                    </Card>
                </Grid>
            ))}
        </Grid>

        <DialogPreview
            open={!!previewUrl}
            onClose={() => setPreviewUrl(null)}
            filePath={previewUrl}
        />

        <UploadPdfDialog
            open={openDialog}
            onClose={() => setOpenDialog(false)}
            onSubmit={handleSubmitUpload}
        />

        <ConfirmDialog
            open={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            onConfirm={confirmDelete}
            title="Xác nhận xoá tệp tin"
            description="Bạn có chắc chắn muốn xoá tệp tin này không?"
        />

        <EmbedDialog
            open={embedDialogOpen}
            onClose={() => { setEmbedDialogOpen(false); setSelectedFilePath(''); }}
            onConfirm={handleEmbedWithParams}
            defaultValues={{ chunkSize: 1000, chunkOverlap: 200 }}
        />

        <Backdrop
            open={isEmbedding}
            sx={{ zIndex: (theme) => theme.zIndex.drawer + 100, color: '#fff' }}
        >
            <CircularProgress color="inherit" />
        </Backdrop>
        </Box>
    );
}
