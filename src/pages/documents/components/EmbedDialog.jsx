import { useState } from 'react';

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Slider, Typography, Box, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function EmbedDialog({ open, onClose, onConfirm, defaultValues }) {
    const [chunkSize, setChunkSize] = useState(defaultValues.chunkSize || 1000);
    const [chunkOverlap, setChunkOverlap] = useState(defaultValues.chunkOverlap || 200);

    const handleConfirm = () => {
        onConfirm({ chunk_size: chunkSize, chunk_overlap: chunkOverlap });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Chọn tham số Embedding</DialogTitle>
        <DialogContent>
            <Box mt={2}>
            <Typography gutterBottom>Độ dài mỗi đoạn (chunk size): {chunkSize} ký tự</Typography>
            <Slider
                value={chunkSize}
                min={200}
                max={2000}
                step={100}
                onChange={(_, value) => setChunkSize(value)}
            />
            </Box>

            <Box mt={4}>
            <Typography gutterBottom>
                Độ chồng lặp giữa các đoạn (chunk overlap): {chunkOverlap} ký tự
                <Tooltip title="Giúp giữ ngữ cảnh khi chia đoạn, ví dụ đoạn sau sẽ chứa lại phần cuối đoạn trước">
                    <InfoOutlinedIcon fontSize="small" sx={{ ml: 1 }} color="action" />
                </Tooltip>
            </Typography>
            <Slider
                value={chunkOverlap}
                min={0}
                max={1000}
                step={50}
                onChange={(_, value) => setChunkOverlap(value)}
            />
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Hủy</Button>
            <Button variant="contained" onClick={handleConfirm}>Xác nhận</Button>
        </DialogActions>
        </Dialog>
    );
}