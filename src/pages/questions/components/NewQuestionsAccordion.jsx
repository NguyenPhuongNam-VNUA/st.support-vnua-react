import { useState } from 'react';

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TextField,
  IconButton,
  Box,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';

import ConfirmDialog from '@/components/DialogConfirm';
  
function NewQuestionsAccordion({ newQuestions = [], setNewQuestions, onSave }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);

  const handleChange = (index, field, value) => {
    const updated = [...newQuestions];
    updated[index][field] = value;
    updated[index].has_answer = !!updated[index].answer?.trim();
    setNewQuestions(updated);
  };

  const handleDelete = (index) => {
    setDeleteConfirmOpen(true);
    setDeleteConfirmIndex(index);
  };

  const confirmDelete = () => {
    const updated = [...newQuestions];
    updated.splice(deleteConfirmIndex, 1);
    setNewQuestions(updated);
    setDeleteConfirmOpen(false);
    setDeleteConfirmIndex(null);
  }

  return (
    <Box>
      <Typography variant="h6" mb={2}>
        Danh sách câu hỏi mới ({newQuestions.length})
      </Typography>

      {newQuestions.map((q, index) => (
        <Accordion key={index}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ color: '#333',fontWeight: 'bold', backgroundColor: '#e0e0e0',}}>
            <Typography sx={{ flexGrow: 1 }}>
              {index + 1}. {q.question || '[Chưa nhập câu hỏi]'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              label="Câu hỏi"
              fullWidth
              size="small"
              margin="dense"
              value={q.question}
              onChange={(e) => handleChange(index, 'question', e.target.value)}
            />
            <TextField
              label="Câu trả lời"
              fullWidth
              size="small"
              margin="dense"
              multiline
              rows={4}
              InputProps={{
                sx: {
                  '& textarea': {
                    resize: 'vertical',
                  }
                }
              }}
              value={q.answer || ''}
              onChange={(e) => handleChange(index, 'answer', e.target.value)}
            />
            <Box display="flex" alignItems="flex-end" justifyContent="space-between" mt={1}>
              <div style={{ flexGrow: 1 }}></div>
              <IconButton color="error" onClick={() => handleDelete(index)}>
                <DeleteIcon />
              </IconButton>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      <Box textAlign="right" mt={2}>
        <Button variant="contained" onClick={onSave} disabled={newQuestions.length === 0}>
          Lưu tất cả
        </Button>
      </Box>

      <ConfirmDialog
        open={ deleteConfirmOpen }
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={ confirmDelete }
        title="Xác nhận xoá câu hỏi"
        description="Bạn có chắc chắn muốn xoá câu hỏi này không?"
      />
    </Box>
  );
}

export default NewQuestionsAccordion;
  