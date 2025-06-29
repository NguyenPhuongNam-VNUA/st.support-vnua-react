// import
import { useState } from 'react';
import {
  Box, Tabs, Tab, Grid, Card, Typography, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, InputLabel, Avatar, Divider, Paper
} from '@mui/material';
import UploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PreviewIcon from '@mui/icons-material/Visibility';
import * as XLSX from 'xlsx';
import { Document, Page } from 'react-pdf';

// sample data
const MOCK_DOCUMENTS = [
  {
    id: 1,
    title: 'Quy chế đào tạo đại học',
    description: 'Tài liệu chính quy về đào tạo tín chỉ',
    fileType: 'pdf',
    author: 'admin@ssovn.edu.vn',
    createdAt: '2025-06-22 08:30'
  },
  {
    id: 2,
    title: 'Danh sách câu hỏi mẫu',
    description: 'File excel mẫu để import dữ liệu',
    fileType: 'excel',
    author: 'namdev@ssovn.edu.vn',
    createdAt: '2025-06-21 22:14'
  },
  {
    id: 3,
    title: 'Thông báo học phí',
    description: 'Thông báo chi tiết học phí theo ngành',
    fileType: 'word',
    author: 'pdt@ssovn.edu.vn',
    createdAt: '2025-06-20 14:00'
  }
];

const fileTypeIcon = {
  pdf: <PictureAsPdfIcon color="error" fontSize="large" />,
  word: <DescriptionIcon color="primary" fontSize="large" />,
  excel: <TableChartIcon color="success" fontSize="large" />
};

export default function DocumentLibraryPage() {
    const [tab, setTab] = useState('all');
    const [tabImport, setTabImport] = useState('excel');
    const [openDialog, setOpenDialog] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', file: null });
    const [excelData, setExcelData] = useState([]);
    const [pdfUrl, setPdfUrl] = useState(null);

    const handleTabChange = (_, value) => setTab(value);
    const handleTabImportChange = (_, value) => setTabImport(value);
    const handleInputChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setForm({ ...form, file });

        const fileType = file?.name.split('.').pop().toLowerCase();

        if (['xlsx', 'xls'].includes(fileType)) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            setExcelData(jsonData);
        };
        reader.readAsArrayBuffer(file);
        } else if (fileType === 'pdf') {
        setPdfUrl(URL.createObjectURL(file));
        } else {
        // word or other
        }
    };

    const handleSubmit = () => {
        console.log('Upload:', form);
        setForm({ title: '', description: '', file: null });
        setExcelData([]);
        setPdfUrl(null);
        setOpenDialog(false);
    };

    const visibleDocs = MOCK_DOCUMENTS.filter(doc => tab === 'all' || doc.fileType === tab);

    return (
        <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Tài liệu quy chế - quy định</Typography>
            <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setOpenDialog(true)}>
            Tải lên tài liệu
            </Button>
        </Box>

        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab label="Tất cả" value="all" />
            <Tab label="Excel" value="excel" />
            <Tab label="Word" value="word" />
            <Tab label="PDF" value="pdf" />
        </Tabs>

        <Grid container spacing={2}>
            {visibleDocs.map(doc => (
            <Grid item xs={12} sm={6} md={4} key={doc.id}>
                <Card sx={{ p: 2 }}>
                <Box display="flex" alignItems="center" gap={2}>
                    {fileTypeIcon[doc.fileType] || <InsertDriveFileIcon fontSize="large" />}
                    <Box>
                    <Typography fontWeight={600}>{doc.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{doc.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {doc.author} - {doc.createdAt}
                    </Typography>
                    </Box>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Button fullWidth variant="outlined" size="small" startIcon={<PreviewIcon />}>Xem trước</Button>
                </Card>
            </Grid>
            ))}
        </Grid>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>
                Thêm tài liệu mới
            </DialogTitle>
            <Tabs value={tabImport} onChange={handleTabImportChange} sx={{ mb: 3, ml: 2 }}>
                <Tab label="Excel" value="excel" />
                <Tab label="Word/PDF" value="word/pdf" />
            </Tabs>
            <DialogContent>
            <Box display="flex" flexDirection="column" gap={2}>
                <TextField
                    name="title"
                    label="Tiêu đề"
                    fullWidth
                    value={form.title}
                    onChange={handleInputChange}
                />
                <TextField
                    name="description"
                    label="Mô tả"
                    fullWidth
                    multiline
                    rows={3}
                    value={form.description}
                    onChange={handleInputChange}
                />
                <Button variant="outlined" component="label">
                    Chọn file để tải lên
                    <input type="file" hidden onChange={handleFileChange} />
                </Button>
                <Typography variant="body2" color="text.secondary">
                    Tải file mẫu:{" "}
                    <a
                        href="/file_mau_ds_cau_hoi.xlsx"
                        download
                        style={{ color: '#1976d2', textDecoration: 'underline' }}
                    >
                        Danh sách câu hỏi mẫu
                    </a>
                </Typography>
                {form.file && <Typography variant="body2" color="text.secondary">Đã chọn: {form.file.name}</Typography>}

                {excelData.length > 0 && (
                <Paper sx={{ p: 2, mt: 2, maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="subtitle2">Xem trước file Excel:</Typography>
                    {excelData.map((row, idx) => (
                    <Typography key={idx} variant="body2">{JSON.stringify(row)}</Typography>
                    ))}
                </Paper>
                )}

                {pdfUrl && (
                <Paper sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Xem trước file PDF:</Typography>
                    <Document file={pdfUrl}>
                    <Page pageNumber={1} width={500} />
                    </Document>
                </Paper>
                )}
            </Box>
            </DialogContent>
            <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
            <Button onClick={handleSubmit} variant="contained">Lưu</Button>
            </DialogActions>
        </Dialog>
        </Box>
    );
}
