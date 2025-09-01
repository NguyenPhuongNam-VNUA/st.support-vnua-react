import { useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { useParams } from 'react-router-dom';
import * as Yup from 'yup';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import { Box, Grid, Card, TextField, Button, Typography, CircularProgress } from '@mui/material';

import questionApi from '@/api/Question/questionApi';
import SuccessAlert from '@/components/SuccessAlert';

const validationSchema = Yup.object().shape({
    question: Yup.string().required('Câu hỏi không được để trống'),
    topic: Yup.string().required('Chủ đề không được để trống'),
    related_questions: Yup.string().optional().nullable(),
    answer: Yup.string().required('Câu trả lời không được để trống'),
    token: Yup.number().max(2048, 'Tổng số tokens không được vượt quá 2048')
});

export default function AddQuestionPage() {
    const [open, setOpen] = useState(false);
    const { id } = useParams(); // Lấy ID từ URL nếu cần thiết
    const [loading, setLoading] = useState(true);
    
    const methods = useForm({
        defaultValues: { 
            question: '',
            answer: '',
            topic: '',
            related_questions: ''
        },
        resolver: yupResolver(validationSchema)
    });
      
    useEffect(() => {
        if (id) {
            setLoading(true);
            questionApi.get(id).then(response => {
                const data = response.data;
                methods.reset({
                    question: data.question,
                    answer: data.answer || '',
                    topic: data.topic || '',
                    related_questions: data.related_questions || ''
                });
            }).finally(() => setLoading(false));
        }
    }, [id, methods]);
      

    const { handleSubmit, control, formState: { isSubmitting }, setValue } = methods;

    const question = methods.watch('question');
    const related_questions = methods.watch('related_questions');
    const [tokenCount, setTokenCount] = useState(0);
    
    // Debounce 500ms
    const [debouncedInput] = useDebounce(`${question}\n${related_questions}`, 500);

    useEffect(() => {
        if (debouncedInput.trim() === '') {
          setTokenCount(0);
          setValue('token', 0);
          return;
        }
    
        questionApi.countInputTokens(debouncedInput)
          .then(response => {
            const count = response.token_count || 0;
            setTokenCount(count);
            setValue('token', count);
            // console.log("Đếm token thành công:", count); 
          })
          .catch(error => {
            console.error("Lỗi khi đếm token:", error);
          });
      }, [debouncedInput, setValue]);

    const cleanText = (text) =>
        (text || '')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line !== '')
          .join('\n');

    const onSubmit = (data) => {
        // console.log('Giá trị form:', data);

        // Call API to update question
        const updatedQuestion = {
            id: id, // Sử dụng ID từ URL
            question: cleanText(data.question),
            answer: cleanText(data.answer),
            has_answer: cleanText(data.answer) !== '',
            topic: cleanText(data.topic),
            related_questions: cleanText(data.related_questions),
        };

        questionApi.update(updatedQuestion)
            .then(response => {
                // console.log('Câu hỏi đã được chỉnh sửa:', response);
                setOpen(true);
                // methods.reset(data);
            })
            .catch(error => {
                console.error('Lỗi khi chỉnh sửa câu hỏi:', error);
            }); 
    };

    return (
        <>
        {open && (
            <SuccessAlert setOpen={setOpen} message="Câu hỏi đã được chỉnh sửa thành công!" />
        )}

        {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        ): (
        <FormProvider {...methods}>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} p={3}>
            <Typography variant="h6" mb={2}>Chỉnh sửa câu hỏi</Typography>

            <Card sx={{ p: 3 }}>
            <Grid container spacing={3}>
                <Grid item xs={12}>
                <Controller
                    name="question"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                    <TextField
                        {...field}
                        fullWidth
                        label={
                            <span>
                                Câu hỏi <span style={{ color: 'red' }}>*</span>
                            </span>
                        }
                        multiline
                        rows={2}
                        error={!!error}
                        helperText={error?.message}
                    />
                    )}
                />
                </Grid>

                <Grid item xs={12}>
                    <Controller
                        name="topic"
                        control={control}
                        render={({ field, fieldState: { error } }) => (
                        <TextField
                            {...field}
                            fullWidth
                            label={
                            <span>
                                Chủ đề liên quan <span style={{ color: 'red' }}>*</span>
                            </span>
                            }
                            multiline
                            maxRows={2}
                            error={!!error}
                            helperText={error?.message}
                        />
                        )}
                    />
                </Grid>

                <Grid item xs={12}>
                    <Controller
                        name="related_questions"
                        control={control}
                        render={({ field, fieldState: { error } }) => (
                        <TextField
                            {...field}
                            fullWidth
                            label="Các biến thể câu hỏi"
                            multiline
                            minRows={2}
                            maxRows={15}
                            error={!!error}
                            helperText={error?.message}
                        />
                        )}
                    />
                </Grid>

                <Grid item xs={12}>
                <Controller
                    name="answer"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                    <TextField
                        {...field}
                        fullWidth
                        label={
                            <span>
                                Câu trả lời <span style={{ color: 'red' }}>*</span>
                            </span>
                        }
                        multiline
                        rows={5}
                        error={!!error}
                        helperText={error?.message}
                    />
                    )}
                />
                </Grid>

                <Grid item xs={12} display="flex" justifyContent="space-between">
                    <Controller 
                        name='token'
                        control={control}
                        render={({ field, fieldState: { error } }) => (
                        <>
                        <Typography variant="caption" color="text.secondary">
                            Tổng số tokens hiện tại
                        </Typography>
                        <Typography
                            variant="caption"
                            color={error ? 'error' : 'text.secondary'}
                        >
                            {tokenCount} / 2048
                        </Typography>
                        {error && (
                            <Typography variant="caption" color="error" sx={{ ml: 2 }}>
                            {error.message}
                            </Typography>
                        )}
                        </>
                        )}
                    />
                </Grid>

                <Grid item xs={12}>
                <Button type="submit" variant="contained" disabled={isSubmitting}>
                    Chỉnh sửa câu hỏi
                </Button>
                </Grid>
            </Grid>
            </Card>
        </Box>
        </FormProvider>
        )}
        </>
    );
}
