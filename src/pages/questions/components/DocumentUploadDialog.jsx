import {
    Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, Tabs, Tab, Paper, TextField
  } from '@mui/material';
  import { useState, useEffect } from 'react';
  import { useForm, Controller, FormProvider } from 'react-hook-form';
  import { yupResolver } from '@hookform/resolvers/yup';
  import * as Yup from 'yup';
  import * as XLSX from 'xlsx';
  import axios from 'axios';
  
  const schema = Yup.object().shape({
    title: Yup.string().required('Tiêu đề không được để trống'),
    description: Yup.string(),
    file: Yup.mixed().required('Vui lòng chọn một file')
  });
  
  export default function DocumentUploadDialog({ open, onClose, initialTab }) {

    const [tab, setTab] = useState('excel');

    useEffect(() => {
        if (initialTab) setTab(initialTab);
    }, [initialTab]);
    const [previewData, setPreviewData] = useState([]);
    const [duplicates, setDuplicates] = useState([]);
    const [checking, setChecking] = useState(false);
  
    const methods = useForm({
      resolver: yupResolver(schema),
      defaultValues: {
        title: '',
        description: '',
        file: null
      }
    });
  
    const { handleSubmit, setValue, watch, control, reset, formState: { isSubmitting } } = methods;
  
    const onFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setValue('file', file);
      const fileType = file.name.split('.').pop().toLowerCase();
  
      if (['xlsx', 'xls'].includes(fileType)) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(worksheet);
          setPreviewData(json);
        };
        reader.readAsArrayBuffer(file);
      }
    };
  
    const handleCheckDuplicates = async () => {
      const formData = new FormData();
      formData.append('file', watch('file'));
  
      try {
        setChecking(true);
        const res = await axios.post('/api/check-excel', formData);
        setDuplicates(res.data.duplicates || []);
      } catch (err) {
        console.error('Lỗi kiểm tra file:', err);
      } finally {
        setChecking(false);
      }
    };
  
    const onSubmit = async (data) => {
      if (duplicates.length > 0) return;
  
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('title', data.title);
      formData.append('description', data.description);
  
      try {
        await axios.post('/api/documents/import-excel', formData);
        reset();
        setPreviewData([]);
        onClose();
      } catch (err) {
        console.error('Upload lỗi:', err);
      }
    };
  
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Import dữ liệu từ file</DialogTitle>
  
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
          <Tab label="Excel" value="excel" />
          <Tab label="Word/PDF" value="word" />
        </Tabs>
  
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Box display="flex" flexDirection="column" gap={2}>
                {tab === 'excel' && (
                <>
                    <Controller
                    name="title"
                    control={control}
                    render={({ field, fieldState }) => (
                        <TextField {...field} label="Tiêu đề" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                    />

                    <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                        <TextField {...field} label="Mô tả" fullWidth multiline rows={3} />
                    )}
                    />

                    <Button variant="outlined" component="label">
                    Chọn file Excel
                    <input type="file" hidden accept=".xlsx,.xls" onChange={onFileChange} />
                    </Button>

                    <Typography variant="body2" color="text.secondary">
                    Tải file mẫu: <a href="/file_mau_ds_cau_hoi.xlsx" download>file_mau_ds_cau_hoi.xlsx</a>
                    </Typography>

                    {previewData.length > 0 && (
                    <Paper sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                        <Typography variant="subtitle2">Xem trước dữ liệu:</Typography>
                        {previewData.slice(0, 5).map((row, idx) => (
                        <Typography key={idx} variant="body2">{JSON.stringify(row)}</Typography>
                        ))}
                    </Paper>
                    )}

                    {duplicates.length > 0 && (
                    <Paper sx={{ p: 2, border: '1px solid red' }}>
                        <Typography color="error" fontWeight={600}>
                        Cảnh báo: {duplicates.length} câu hỏi bị trùng!
                        </Typography>
                        {duplicates.map((q, i) => (
                        <Typography key={i} variant="body2">- {q.question}</Typography>
                        ))}
                    </Paper>
                    )}
                </>
                )}

                {tab === 'word' && (
                <Typography variant="body2" color="text.secondary">
                    (Chức năng import Word/PDF chưa được hỗ trợ trong demo này)
                </Typography>
                )}
            </Box>
            </DialogContent>

            <DialogActions>
              <Button onClick={onClose}>Hủy</Button>
              <Button variant="outlined" onClick={handleCheckDuplicates} disabled={checking}>
                {checking ? 'Đang kiểm tra...' : 'Kiểm tra trùng'}
              </Button>
              <Button type="submit" variant="contained" disabled={duplicates.length > 0 || isSubmitting}>
                Lưu dữ liệu
              </Button>
            </DialogActions>
          </form>
        </FormProvider>
      </Dialog>
    );
  }
  