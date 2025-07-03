// ImportExcelPage.jsx (Cập nhật để match 2 component bảng)
import { useState } from 'react';
import * as Yup from 'yup';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as XLSX from 'xlsx';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { styled } from '@mui/material/styles';

import UploadFileIcon from '@mui/icons-material/UploadFile';
import TableChartIcon from '@mui/icons-material/TableChart';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';

import PreviewExcelDialog from './components/PreviewExcelDialog';
import NewQuestionsAccordion from './components/NewQuestionsAccordion';
import DuplicateQuestionsTable from './components/DuplicateQuestionsTable';
import questionsExcelApi from '@/api/Question/questionsExcelApi';
import questionApi from '@/api/Question/questionApi';
import SuccessAlert from '@/components/SuccessAlert';

const StyledCard = styled(Card)(() => ({
    padding: 24,
    minHeight: 200,
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    '.alert-text': {
        maxWidth: 200,
        display: 'block',
        marginTop: '1rem',
        textAlign: 'center',
    }
}));

const validationSchema = Yup.object().shape({
    file: Yup.mixed()
        .required('Vui lòng chọn một file Excel')
        .test('fileFormat', 'Chỉ chấp nhận file Excel (.xlsx)', (value) => value && value.name?.endsWith('.xlsx'))
});

function ImportExcelPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [openPreview, setOpenPreview] = useState(false);
    const [checkData, setCheckedData] = useState([]);
    const [tab, setTab] = useState('new');
    const [newQuestions, setNewQuestions] = useState([]);
    const [duplicateQuestions, setDuplicateQuestions] = useState([]);
    const [openAlert, setOpenAlert] = useState(false);

    const methods = useForm({
        resolver: yupResolver(validationSchema),
        defaultValues: { file: null }
    });
    const { handleSubmit, control, formState: { isSubmitting } } = methods;

    const onSubmit = () => {
        const checkData = previewData.slice(1)
            .filter(row => row[1] || row[2])
            .map(row => (
                { 
                    question: (row[1] || '').trim(),
                    answer: (row[2] || '').trim(),
                    has_answer: !!row[2] // Boolean(row[2]),
                }
            ));

        const requestBody = { questions: checkData };
        questionsExcelApi.checkData(requestBody)
            .then((response) => {
                const results = response.results || [];
                setCheckedData(results);
                // console.log('Kết quả kiểm tra:', checkData);
                setNewQuestions(results.filter(item => !item.is_duplicate));
                setDuplicateQuestions(results.filter(item => item.is_duplicate));

                // console.log('Câu hỏi mới:', results.filter(item => !item.is_duplicate));
                // console.log('Câu hỏi trùng lặp:', results.filter(item => item.is_duplicate));
            })
            .catch((error) => {
                console.error('Lỗi khi kiểm tra dữ liệu Excel:', error);
            });
    };

    const handleChangeFile = (e) => {
        const file = e.target.files[0];
        if (file) setSelectedFile(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            setPreviewData(jsonData);
        };
        reader.readAsArrayBuffer(file);
    };

    const cleanText = (text) => {
        return text.split('\n')
          .map(line => line.trim())
          .filter(line => line !== '')
          .join('\n');
    }

    const handleSaveNew = () => {
        const cleanQuestions = newQuestions.map(q => ({
            question: cleanText(q.question),
            answer: cleanText(q.answer),
            has_answer: q.has_answer,
        }));
        // console.log('Lưu câu hỏi mới:', cleanQuestions);
        // TODO: gọi API Laravel để lưu batch
        questionApi.addNewQuestions({ newQuestions: cleanQuestions })
            .then((response) => {
                console.log('Câu hỏi mới đã được lưu:', response);
                setNewQuestions([]);
                setOpenAlert(true);
            })
            .catch((error) => {
                console.error('Lỗi khi lưu câu hỏi mới:', error);
            });
    };

    const handleChangeDuplicateAction = (index, value) => {
        // console.log('Thay đổi hành động cho câu hỏi trùng:', index, value);
        const updated = [...duplicateQuestions];
        updated[index].action = value;
        setCheckedData([...newQuestions, ...updated]);
        // console.log(checkData);  
    };

    const handleConfirmDuplicate = async () => {
        try {
           
            const overwrites = duplicateQuestions.filter(q => q.action === 'overwrite');
            const createNews = duplicateQuestions.filter(q => q.action === 'create_new');
            console.log('Câu hỏi cần ghi đè:', overwrites);
            // 3. Nếu có câu cần ghi đè → gọi API update
            if (overwrites.length > 0) {
                const formatted = overwrites.map(q => ({
                    id: q.existing_id, // ID của câu hỏi đã tồn tại
                    question: q.question,
                    answer: q.answer || '',
                    has_answer: !!q.answer?.trim()
                }));
                const res = await questionApi.updateDuplicateQuestions({ duplicateQuestions: formatted });
                console.log('Đã ghi đè:', res);
            }
        
            // 4. Nếu có câu cần tạo mới → gọi API thêm mới
            if (createNews.length > 0) {
                const formatted = createNews.map(q => ({
                    question: q.question,
                    answer: q.answer || '',
                    has_answer: !!q.answer?.trim()
                }));
        
                const res = await questionApi.addNewQuestions({ newQuestions: formatted });
                console.log('Đã tạo mới:', res);
            }
        
            setDuplicateQuestions([]);
            setOpenAlert(true);
      
        } catch (error) {
          console.error('Lỗi khi xử lý câu hỏi trùng lặp:', error);
        }
    };

    return (
        <div className="pt-2 pb-4">
            {openAlert && (
                <SuccessAlert setOpen={setOpenAlert} message="Các câu hỏi đã được thêm thành công!" />
            )}
            <FormProvider {...methods}>
            <Grid container spacing={3}>
                <Grid size={{ md: 3, xs: 12 }}>
                    <StyledCard>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <Box textAlign="center">
                            <Controller
                                name="file"
                                control={control}
                                render={({ field, fieldState: { error } }) => (
                                    <>
                                    <input
                                        type="file"
                                        accept=".xlsx"
                                        id="excel-upload"
                                        hidden
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            field.onChange(file);
                                            handleChangeFile(e);
                                        }}
                                    />
                                    {error && (
                                        <Typography variant="caption" color="error">
                                            {error.message}
                                        </Typography>
                                    )}
                                    </>
                                )}
                            />
                            <label htmlFor="excel-upload">
                                <Button variant="outlined" startIcon={<UploadFileIcon />} component="span">
                                    Chọn file Excel
                                </Button>
                            </label>
                            <Typography mt={2} fontSize={12} color="text.secondary">
                                File mẫu tại đây:&nbsp;
                                <a href="/file_mau_ds_cau_hoi.xlsx" download style={{ color: '#1976d2', textDecoration: 'underline' }}>
                                    Danh sách câu hỏi mẫu
                                </a>
                            </Typography>
                        </Box>

                        {selectedFile && (
                            <div style={{ maxWidth: 250, width: '100%' }}>
                            <Box display="flex" alignItems="center" gap={2} mt={6} p={2} border="1px solid #ccc" borderRadius={2}>
                                <TableChartIcon color="success" fontSize="medium" />
                                <Box>
                                    <Typography sx={{ fontSize: 14}} fontWeight={600}>{selectedFile.name}</Typography>
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" color="text.secondary">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </Typography>
                                        <IconButton onClick={() => setOpenPreview(true)} size="small" color="text.secondary">
                                            <VisibilityOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </Box>
                            <Box mt={3} textAlign="end">
                                <Button type="submit" variant="contained" size="small" disabled={isSubmitting}>
                                    <ArrowCircleRightOutlinedIcon fontSize="small" /> Kiểm tra
                                </Button>
                            </Box>
                            </div>
                        )}
                    </form>
                    </StyledCard>
                </Grid>

                <Grid size={{ md: 9, xs: 12 }}>
                    <Card className="p-3" sx={{ minHeight: 500, display: 'flex', flexDirection: 'column' }}>
                        <Tabs value={tab} onChange={(e, val) => setTab(val)} sx={{ mb: 3 }}>
                            <Tab label="Câu hỏi mới" value="new" />
                            <Tab label="Câu bị trùng lặp" value="duplicate" />
                        </Tabs>
                        {tab === 'new' && <NewQuestionsAccordion newQuestions={newQuestions} setNewQuestions={setNewQuestions} onSave={handleSaveNew} />}
                        {tab === 'duplicate' && (
                            <DuplicateQuestionsTable
                                duplicateQuestions={duplicateQuestions}
                                onConfirm={handleConfirmDuplicate}
                                onChangeAction={handleChangeDuplicateAction}
                            />
                        )}
                    </Card>
                </Grid>
            </Grid>

            {openPreview && (
                <PreviewExcelDialog
                    openPreview={openPreview}
                    onClose={() => setOpenPreview(false)}
                    previewData={previewData}
                />
            )}
            </FormProvider>
        </div>
    );
}

export default ImportExcelPage;