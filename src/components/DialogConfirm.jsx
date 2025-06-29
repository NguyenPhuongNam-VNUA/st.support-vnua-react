import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Button
} from '@mui/material';
  
export default function ConfirmDialog({ open, onClose, onConfirm, title, description }) {
    return (
        <Dialog open={open} onClose={onClose}>
        <DialogTitle>{title || 'Xác nhận xoá'}</DialogTitle>
        <DialogContent>
            <DialogContentText>{description || 'Bạn có chắc chắn muốn xoá mục này?'}</DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Huỷ</Button>
            <Button onClick={onConfirm} color="error" variant="contained">Xoá</Button>
        </DialogActions>
        </Dialog>
    );
}
  