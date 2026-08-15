'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { MessageSquarePlus, Save, SquarePen } from 'lucide-react';
import questionApi from '@/api/admin/questionApi';

interface EditableQuestion {
  id: number;
  question: string;
  answer: string | null;
  topic: string | null;
  status: string;
}

interface QuestionEditDialogProps {
  open: boolean;
  question: EditableQuestion | null;
  topics: string[];
  onClose: () => void;
  onSaved: (question: EditableQuestion) => void;
}

export default function QuestionEditDialog({
  open,
  question,
  topics,
  onClose,
  onSaved,
}: QuestionEditDialogProps) {
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [topic, setTopic] = useState('Khác');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!question) return;
    setQuestionText(question.question || '');
    setAnswerText(question.answer || '');
    setTopic(question.topic || 'Khác');
    setError(null);
  }, [question]);

  const handleSave = async () => {
    if (!question || !questionText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response: any = await questionApi.update(question.id, {
        question: questionText,
        answer: answerText,
        topic,
      });
      onSaved(response.data);
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Không thể lưu thay đổi');
    } finally {
      setSaving(false);
    }
  };

  const wasUnanswered = !question?.answer?.trim();

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="question-edit-dialog-title"
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle id="question-edit-dialog-title" sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            width={40}
            height={40}
            borderRadius={2}
            bgcolor={wasUnanswered ? '#fff7ed' : '#ecfdf5'}
            color={wasUnanswered ? '#c2410c' : '#047857'}
          >
            {wasUnanswered ? <MessageSquarePlus size={20} aria-hidden="true" /> : <SquarePen size={20} aria-hidden="true" />}
          </Box>
          <Box>
            <Typography component="span" variant="h6" fontWeight={800}>
              {wasUnanswered ? 'Thêm câu trả lời' : 'Sửa câu hỏi và câu trả lời'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Câu hỏi #{question?.id}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box display="flex" flexDirection="column" gap={2.25} pt={0.5}>
          <TextField
            label="Nội dung câu hỏi"
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            required
            multiline
            minRows={2}
            inputProps={{ maxLength: 2000 }}
          />
          <TextField
            label="Câu trả lời chuẩn"
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            multiline
            minRows={5}
            autoFocus={wasUnanswered}
            helperText={!answerText.trim() ? 'Câu hỏi chưa thể được duyệt khi chưa có câu trả lời.' : `${answerText.length}/10000 ký tự`}
            inputProps={{ maxLength: 10000 }}
          />
          <FormControl>
            <InputLabel id="edit-question-topic-label">Chủ đề</InputLabel>
            <Select
              labelId="edit-question-topic-label"
              label="Chủ đề"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            >
              {topics.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Hủy
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !questionText.trim()}
          variant="contained"
          startIcon={<Save size={17} aria-hidden="true" />}
          sx={{ bgcolor: '#0d8a4f', textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#0a7543' } }}
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
