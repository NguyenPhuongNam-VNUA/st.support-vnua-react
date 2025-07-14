import { useState } from 'react';
import * as Yup from 'yup';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import { Box, Grid, Card, TextField, Button, Typography } from '@mui/material';

import questionApi from '@/api/Question/questionApi';
import SuccessAlert from '@/components/SuccessAlert';
import DuplicateAlert from '@/components/DuplicateAlert';

const validationSchema = Yup.object().shape({
  question: Yup.string().required('Câu hỏi không được để trống'),
  answer: Yup.string().optional().nullable()
});

export default function AddQuestionPage() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  const methods = useForm({
    defaultValues: {
      question: '',
      answer: ''
    },
    resolver: yupResolver(validationSchema)
  });

  const { handleSubmit, control, formState: { isSubmitting } } = methods;

  const cleanText = (text) =>
    (text || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .join('\n');
  
  const onSubmit = (data) => {
    console.log('Giá trị form:', data);

    // Call API to add question
    const newQuestion = {
      question: cleanText(data.question),
      answer: cleanText(data.answer),
      has_answer: cleanText(data.answer) !== '',
    };
    console.log('Câu hỏi mới:', newQuestion);
    
    questionApi.add(newQuestion)
        .then(response => {
            console.log('Câu hỏi đã được thêm:', response);
            setOpen(true);
            methods.reset({
              question: '',
              answer: ''
            });
        })
        .catch(error => {
          if (error.response && error.response.status === 409) {
            const data = error.response.data;
            setError({
              question: data.question,
              score_str: data.score,
            });
            methods.reset({
              question: data.question,
              answer: data.answer || ''
            });
          } else {
            console.error("Lỗi không xác định:", error);
          }
        });
  };

  return (
    <>
    {open && (
      <SuccessAlert setOpen={setOpen} message="Câu hỏi đã được thêm thành công!" />
    )}

    {error && (
      <DuplicateAlert setError={setError} question={ error.question } score_str={ error.score_str } />
    )}

    <FormProvider {...methods}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} p={3}>
        <Typography variant="h6" mb={2}>Thêm Câu Hỏi Mới</Typography>

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
                Lưu câu hỏi
              </Button>
            </Grid>
          </Grid>
        </Card>
      </Box>
    </FormProvider>
    </>
  );
}
