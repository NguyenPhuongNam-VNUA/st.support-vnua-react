import {
    Box, Dialog, Typography,
    Table, TableHead, TableBody, TableRow, TableCell,
    Button
  } from "@mui/material";
  
  function PreviewExcelDialog({ openPreview, onClose, previewData }) {
    return (
      <Dialog open={openPreview} onClose={onClose} maxWidth="lg" fullWidth>
        <Box p={3}>
          <Typography variant="h6" gutterBottom>
            Xem trước nội dung file Excel
          </Typography>
  
          <Box
            maxHeight="500px"
            overflow="auto"
            sx={{
              border: '1px solid #ccc',
              borderRadius: 2,
              mt: 2,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                {previewData.length > 0 && (
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    {previewData[0].map((cell, idx) => (
                      <TableCell
                        key={idx}
                        sx={{
                            color: '#333',
                            fontWeight: 'bold',
                            backgroundColor: '#e0e0e0',
                            borderRight: '1px solid #ddd',
                            whiteSpace: 'nowrap',
                            padding: '8px 16px',
                        }}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </TableHead>
              <TableBody>
                {previewData.slice(1).map((row, rowIdx) => (
                  <TableRow
                    key={rowIdx}
                    sx={{
                      '&:nth-of-type(odd)': { backgroundColor: '#fafafa' },
                      '&:hover': { backgroundColor: '#f0f0f0' },
                    }}
                  >
                    {row.map((cell, cellIdx) => (
                      <TableCell
                        key={cellIdx}
                        sx={{
                            borderRight: '1px solid #f0f0f0',
                            whiteSpace: 'nowrap',
                            padding: '8px 16px',
                            fontSize: '0.875rem',
                            color: '#555',
                            textOverflow: 'ellipsis',
                        }}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
  
          <Box textAlign="right" mt={2}>
            <Button variant="outlined" onClick={onClose}>
              Đóng
            </Button>
          </Box>
        </Box>
      </Dialog>
    );
  }
  
  export default PreviewExcelDialog;
  