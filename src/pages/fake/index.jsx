import {
    Box, Typography, Paper, TextField, Table, TableHead, TableRow,
    TableCell, TableBody, RadioGroup, FormControlLabel, Radio, Button
  } from '@mui/material';
  
  const MOCK_DUPLICATES = [
    {
      old: 'Em muốn xin giấy xác nhận là sinh viên thì xin ở đâu ạ?',
      new: 'Giấy xác nhận sinh viên xin ở đâu?',
      selected: 'old'
    },
    {
      old: 'Em muốn tra thông tin thời gian, tuyến khám chữa bệnh ban đầu ở thẻ BHYT thì tra ở đâu ạ?',
      new: 'Tra cứu thời gian, tuyến khám chữa bệnh ban đầu ở thẻ BHYT',
      selected: 'new'
    }
  ];
  
  export default function FakeDuplicateUI() {
    return (
      <Box
        sx={{
          maxWidth: 900,
          mx: 'auto',
          mt: 8,
          p: 4,
          borderRadius: 3,
          boxShadow: 3,
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
        }}
      >
        <Typography variant="h6" fontWeight={600} mb={2}>
          Import danh sách câu hỏi từ file Excel
        </Typography>
  
        <Box display="flex" flexDirection="column" gap={2}>
          <TextField label="Tiêu đề" value="Import câu hỏi sinh viên" fullWidth />
          <TextField
            label="Mô tả"
            value="File Excel chứa dữ liệu câu hỏi - câu trả lời"
            multiline
            rows={3}
            fullWidth
          />
  
          <Typography variant="body2" color="text.secondary">
            Đã chọn: <b>file_cau_hoi.xlsx</b>
          </Typography>
  
          <Paper sx={{ p: 2, border: '1px solid #ffa726' }}>
            <Typography color="warning.main" fontWeight={600} mb={1}>
              ⚠️ Phát hiện 2 câu hỏi bị trùng:
            </Typography>
  
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="45%">Câu trong hệ thống</TableCell>
                  <TableCell width="45%">Câu trong file</TableCell>
                  <TableCell align="center">Chọn</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {MOCK_DUPLICATES.map((dup, index) => (
                  <TableRow key={index}>
                    <TableCell>{dup.old}</TableCell>
                    <TableCell>{dup.new}</TableCell>
                    <TableCell align="center">
                      <RadioGroup row value={dup.selected}>
                        <FormControlLabel value="old" control={<Radio />} label="Giữ cũ" />
                        <FormControlLabel value="new" control={<Radio />} label="Dùng mới" />
                      </RadioGroup>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
  
          <Box display="flex" justifyContent="flex-end" gap={2}>
            <Button variant="outlined">Hủy</Button>
            <Button variant="contained" disabled>
              Lưu dữ liệu
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }
  