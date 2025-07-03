import {
    Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
    RadioGroup, FormControlLabel, Radio, Button, Paper, Chip
  } from '@mui/material';
  
  function DuplicateQuestionsTable({ duplicateQuestions = [], onConfirm, onChangeAction }) {
    return (
      <Box>
        <Typography variant="h6" fontWeight={600} mb={3}>
          Câu hỏi bị trùng ({duplicateQuestions.length})
        </Typography>
  
        <Paper variant="outlined">
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f4f6f8' }}>
              <TableRow>
                <TableCell sx={{ color: '#333'}} width="40" padding='1px'>#</TableCell>
                <TableCell sx={{ color: '#333'}} width="30%">Câu hỏi mới</TableCell>
                <TableCell sx={{ color: '#333'}} width="30%">Câu đã tồn tại</TableCell>
                <TableCell sx={{ color: '#333'}} width="80">Tỉ lệ</TableCell>
                <TableCell sx={{ color: '#333'}} align='center'>Hành động</TableCell>
              </TableRow>
            </TableHead>
  
            <TableBody>
              {duplicateQuestions.map((q, index) => (
                <TableRow key={index} hover>
                  <TableCell padding='1px'>{index + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.primary">
                      {q.question}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {q.existing_doc || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${q.score?.toFixed(2) || 0}%`}
                      color={q.score >= 90 ? 'success' : q.score >= 70 ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <RadioGroup
                      row
                      value={q.action || ''}
                      onChange={(e) => onChangeAction(index, e.target.value)}
                    >
                      <FormControlLabel value="skip" control={<Radio size="small" />} label="Bỏ qua" />
                      <FormControlLabel value="overwrite" control={<Radio size="small" />} label="Ghi đè" />
                      <FormControlLabel value="create_new" control={<Radio size="small" />} label="Tạo mới" />
                    </RadioGroup>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
  
        <Box textAlign="right" mt={3}>
          <Button
            variant="contained"
            color="primary"
            disabled={duplicateQuestions.length === 0}
            onClick={onConfirm}
          >
            Thực hiện cập nhật
          </Button>
        </Box>
      </Box>
    );
  }
  
  export default DuplicateQuestionsTable;
  