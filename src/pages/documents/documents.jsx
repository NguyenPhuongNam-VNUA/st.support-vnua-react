// DocumentLibraryPage.jsx (UI kết nối Laravel, xử lý upload + fetch tài liệu)
import { useEffect, useState } from 'react';
import {
  Box, Tabs, Tab, Grid, Card, Typography, Button, Divider, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import UploadIcon from '@mui/icons-material/CloudUpload';
import PreviewIcon from '@mui/icons-material/Visibility';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import documentApi from '@/api/Document/documentApi';

export default function DocumentLibraryPage() {
    const [openDialog, setOpenDialog] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', file: null });
    const [documents, setDocuments] = useState([]);

    const fetchDocuments = async () => {
        try {
        const res = await documentApi.getAll();
        setDocuments(res.data);
        } catch (err) {
        console.error('Lỗi khi tải danh sách tài liệu:', err);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file || !file.name.endsWith('.pdf')) return;
        setForm({ ...form, file });
    };

    const handleSubmit = async () => {
        try {
        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('description', form.description);
        formData.append('file', form.file);

        await documentApi.add(formData);
        setForm({ title: '', description: '', file: null });
        setOpenDialog(false);
        fetchDocuments();
        } catch (error) {
        console.error('Lỗi khi upload:', error);
        }
    };

    const handleEmbed = async (filePath) => {
        try {
            await documentApi.embed(filePath);
            alert('Embedding thành công!');
        } catch (error) {
            console.error('Lỗi khi embedding:', error);
            alert('Đã xảy ra lỗi khi embedding tài liệu.');
        }
    }

    return (
        <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Thư viện tài liệu PDF</Typography>
            <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setOpenDialog(true)}>
            Tải lên tài liệu
            </Button>
        </Box>

        <Grid container spacing={2}>
            {documents.map((doc) => (
            <Grid item xs={12} sm={6} md={4} key={doc.id}>
                <Card sx={{ p: 2 }}>
                <Box display="flex" gap={2} alignItems="center">
                    <PictureAsPdfIcon color="error" fontSize="large" />
                    <Box>
                    <Typography fontWeight={600}>{doc.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{doc.description}</Typography>
                    <Typography variant="caption" color="text.secondary">{doc.file_type?.toUpperCase()} - {doc.created_at}</Typography>
                    </Box>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box display="flex" justifyContent="space-between" mt={1} gap={3}>
                    <Button variant="outlined" fullWidth size="small" startIcon={<PreviewIcon />}>Xem trước</Button>
                    <Button size="small" sx={{ padding: 2}} onClick={() => handleEmbed(doc.file_path)}>Embedding</Button>
                </Box>
                </Card>
            </Grid>
            ))}
        </Grid>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>Tải lên tài liệu PDF</DialogTitle>
            <DialogContent>
            <Box display="flex" flexDirection="column" gap={2}>
                <TextField label="Tiêu đề" name="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} fullWidth />
                <TextField label="Mô tả" name="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={3} />
                <Button variant="outlined" component="label">
                Chọn file PDF
                <input type="file" hidden accept="application/pdf" onChange={handleFileChange} />
                </Button>
                {form.file && <Typography variant="body2" color="text.secondary">Đã chọn: {form.file.name}</Typography>}
            </Box>
            </DialogContent>
            <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
            <Button variant="contained" onClick={handleSubmit}>Lưu</Button>
            </DialogActions>
        </Dialog>
        </Box>
    );
}
