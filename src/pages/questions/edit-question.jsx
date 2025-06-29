import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as Yup from 'yup';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import { Box, Grid, Card, TextField, Button, Typography } from '@mui/material';

import questionApi from '@/api/Question/questionApi';
import SuccessAlert from '@/components/SuccessAlert';

const validationSchema = Yup.object().shape({
  question: Yup.string().required('Câu hỏi không được để trống'),
  answer: Yup.string().optional().nullable()
});

export default function AddQuestionPage() {
    const [open, setOpen] = useState(false);
    const { id } = useParams(); // Lấy ID từ URL nếu cần thiết
    
    const methods = useForm({
        defaultValues: { question: '', answer: '' },
        resolver: yupResolver(validationSchema)
    });
      
    useEffect(() => {
        if (id) {
            questionApi.get(id).then(response => {
                const data = response.data;
                methods.reset({
                    question: data.question,
                    answer: data.answer || ''
                });
            });
        }
    }, [id, methods]);
      

    const { handleSubmit, control, formState: { isSubmitting } } = methods;

    const onSubmit = (data) => {
        console.log('Giá trị form:', data);

        // Call API to update question
        const updatedQuestion = {
            id: id, // Sử dụng ID từ URL
            question: data.question.trim(),
            answer: data.answer.trim(),
            has_answer: data.answer.trim() !== ''
        };

        questionApi.update(updatedQuestion)
            .then(response => {
                console.log('Câu hỏi đã được chỉnh sửa:', response);
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
                        label="Câu hỏi"
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
                    name="answer"
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                    <TextField
                        {...field}
                        fullWidth
                        label="Câu trả lời"
                        multiline
                        rows={5}
                        error={!!error}
                        helperText={error?.message}
                    />
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
        </>
    );
}
