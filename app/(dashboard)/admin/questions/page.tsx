'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';

import NewQuestionsAccordion from '@/components/questions/NewQuestionsAccordion';
import DuplicateQuestionsTable from '@/components/questions/DuplicateQuestionsTable';
import PreviewExcelDialog from '@/components/questions/PreviewExcelDialog';

export default function QuestionsPage() {
  const [newQuestions, setNewQuestions] = useState<any[]>([]);
  const [duplicateQuestions, setDuplicateQuestions] = useState<any[]>([]);
  const [openPreview, setOpenPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const handleSaveAll = () => {
    console.log('Lưu tất cả câu hỏi:', newQuestions);
  };

  const handleConfirmDuplicate = () => {
    console.log('Xác nhận cập nhật câu hỏi trùng:', duplicateQuestions);
  };

  const handleChangeAction = (index: number, action: string) => {
    const updated = [...duplicateQuestions];
    updated[index].action = action;
    setDuplicateQuestions(updated);
  };

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight={700} mb={3}>
        Quản lý & Duyệt Câu hỏi
      </Typography>

      <Card sx={{ p: 3, mb: 4 }}>
        <NewQuestionsAccordion
          newQuestions={newQuestions}
          setNewQuestions={setNewQuestions}
          onSave={handleSaveAll}
        />
      </Card>

      <Card sx={{ p: 3 }}>
        <DuplicateQuestionsTable
          duplicateQuestions={duplicateQuestions}
          onConfirm={handleConfirmDuplicate}
          onChangeAction={handleChangeAction}
        />
      </Card>

      <PreviewExcelDialog
        openPreview={openPreview}
        onClose={() => setOpenPreview(false)}
        previewData={previewData}
      />
    </Box>
  );
}
