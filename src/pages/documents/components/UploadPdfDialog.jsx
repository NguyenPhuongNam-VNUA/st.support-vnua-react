import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Typography
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

const schema = yup.object().shape({
  title: yup.string().required('Tiêu đề không được để trống'),
  description: yup.string(),
  file: yup
    .mixed()
    .test('is-pdf', 'File phải là PDF', (value) => {
      return value && value.type === 'application/pdf';
    })
    .required('Phải chọn file PDF'),
});

export default function UploadPdfDialog({ open, onClose, onSubmit }) {
  const { control, handleSubmit, watch, reset, setValue } = useForm({
    defaultValues: {
      title: '',
      description: '',
      file: null
    },
    resolver: yupResolver(schema)
  });

  const selectedFile = watch('file');

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFormSubmit = (data) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('file', data.file);
    
    onSubmit(formData);
    reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Tải lên tài liệu PDF</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <Controller
            name="title"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                fullWidth
                label="Tiêu đề"
                error={!!error}
                helperText={error?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Mô tả"
                multiline
                rows={3}
              />
            )}
          />
          <Button variant="outlined" component="label">
            Chọn file PDF
            <input
              type="file"
              hidden
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setValue('file', file);
                }
              }}
            />
          </Button>
          {selectedFile && (
            <Typography variant="body2" color="text.secondary">
              Đã chọn: {selectedFile.name}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Hủy</Button>
        <Button variant="contained" onClick={handleSubmit(onFormSubmit)}>Lưu</Button>
      </DialogActions>
    </Dialog>
  );
}
