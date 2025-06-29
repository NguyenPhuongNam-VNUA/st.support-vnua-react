import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Box, TableContainer, Table, TableHead, TableBody,
  TableRow, TableCell, Checkbox, Typography, Button, Tabs, Tab,
  TextField, styled, Menu, MenuItem, IconButton, TablePagination
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import Search from '@mui/icons-material/Search';
import Add from '@mui/icons-material/Add';
import QuizIcon from '@mui/icons-material/Quiz';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import questionApi from '@/api/Question/questionApi';
import FlexBetween from '@/components/flexbox/FlexBetween';
import FlexBox from '@/components/flexbox/FlexBox';
import { TableDataNotFound } from '@/components/table';
import ConfirmDialog from '@/components/DialogConfirm';
import SuccessAlert from '@/components/SuccessAlert';

const SearchTextField = styled(TextField)(({ theme }) => ({
    maxWidth: 400,
    width: '100%',
    marginTop: 18,
    marginBottom: 18,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 8,
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    fontWeight: 700,
    fontSize: '0.95rem',
    color: theme.palette.grey[900],
    backgroundColor: theme.palette.grey[100],
    borderBottom: `1px solid ${theme.palette.divider}`,
}));

export default function QuestionListPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tab, setTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [anchorElById, setAnchorElById] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null);
  const [open, setOpen] = useState(false); //open Alert

  // Call API to fetch questions
  useEffect(() => {
    const fetchAnswers = async () => {
      const questions = await questionApi.getAll();
      setQuestions(questions.data);
    };
    fetchAnswers();
  }, []);

  const handleMenuOpen = (event, id) => {
    setAnchorElById(prev => ({ ...prev, [id]: event.currentTarget }));
  };

  const handleMenuClose = (id) => {
    setAnchorElById(prev => ({ ...prev, [id]: null }));
  };

  const handleDeleteOne = (id) => {
    setQuestionToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await questionApi.remove(questionToDelete);
      setQuestions(prev => prev.filter(q => q.id !== questionToDelete));
      setSelectedIds(prev => prev.filter(x => x !== questionToDelete));
      setOpen(true); // Hiển thị thông báo thành công
    } catch (error) {
      console.error('Lỗi khi xoá:', error);
      alert('Xoá thất bại.');
    } finally {
      setDeleteConfirmOpen(false);
      setQuestionToDelete(null);
    }
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const questionText = q.question || '';
      const answerText = q.answer || '';
  
      const matchSearch =
        questionText.toLowerCase().includes(searchText.toLowerCase()) ||
        answerText.toLowerCase().includes(searchText.toLowerCase());
  
      const matchTab =
        tab === 'all' ||
        (tab === 'answered' && q.has_answer) ||
        (tab === 'unanswered' && !q.has_answer);
  
      return matchSearch && matchTab;
    });
  }, [questions, tab, searchText]);

  const paginatedQuestions = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredQuestions.slice(start, end);
  }, [filteredQuestions, page, rowsPerPage]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
  
    const confirm = window.confirm(`Bạn có chắc chắn muốn xoá ${selectedIds.length} câu hỏi?`);
    if (!confirm) return;
  
    try {
      await questionApi.removeMany(selectedIds);
      setQuestions(prev => prev.filter(q => !selectedIds.includes(q.id)));
      setSelectedIds([]);
      setOpen(true); // Hiển thị thông báo thành công
    } catch (error) {
      console.error('Lỗi khi xoá hàng loạt:', error);
      alert('Xoá thất bại. Vui lòng thử lại!');
    }
  };
  

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <>
    {open && (
      <SuccessAlert setOpen={setOpen} message="Câu hỏi đã được xoá thành công!" />
    )}
    <Box sx={{ p: 2, backgroundColor: '#f4f4f4', minHeight: '100vh'}}>
      <Card elevation={3}>
        <FlexBetween flexWrap="wrap" gap={1} px={2} pt={2}>
          <FlexBox alignItems="center" gap={1.5}>
            <QuizIcon className="icon" />
            <Typography variant="h6" fontWeight={700} color="text.primary">
              Danh sách câu hỏi
            </Typography>
          </FlexBox>
          
          {/* onChange của  Tabs có 2 tham số: event và value, _ là tham số event, v là giá trị mới của tab */}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ my: 1 }}> 
            <Tab label="Tất cả" value="all" />
            <Tab label="Đã trả lời" value="answered" />
            <Tab label="Chưa trả lời" value="unanswered" />
          </Tabs>
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/questions/add')}>
            Tạo mới
          </Button>
        </FlexBetween>

        <Box px={2} pt={2} display="flex" justifyContent="space-between" alignItems="center">
          <SearchTextField
            placeholder="Tìm kiếm..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ mr: 1 }} /> }}
          />
          {selectedIds.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteSelected}
            >
              Xóa ({selectedIds.length})
            </Button>
          )}
        </Box>

        <TableContainer sx={{ px: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <StyledTableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < filteredQuestions.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredQuestions.map(q => q.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </StyledTableCell>
                <StyledTableCell align="center" width={60}>STT</StyledTableCell>
                <StyledTableCell>Câu hỏi</StyledTableCell>
                <StyledTableCell>Trả lời</StyledTableCell>
                <StyledTableCell align="center">Trạng thái</StyledTableCell>
                <StyledTableCell align="center">Hành động</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedQuestions.length === 0 ? (
                <TableDataNotFound/>
              ) : (
                paginatedQuestions.map((q, index) => (
                  <TableRow
                    key={q.id}
                    hover
                    sx={{
                      transition: 'background-color 0.2s',
                      '&:hover': { backgroundColor: '#f9f9f9' },
                      '& td': { backgroundColor: '#fff', color: '#333' },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.includes(q.id)}
                        onChange={() => toggleSelect(q.id)}
                      />
                    </TableCell>
                    <TableCell align="center">{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{q.question}</TableCell>
                    <TableCell>{q.answer || '-'}</TableCell>
                    <TableCell align="center">
                      <Typography fontWeight={500} color={q.has_answer ? 'success.main' : 'text.secondary'}>
                        {q.has_answer ? 'Đã trả lời' : 'Chưa trả lời'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton onClick={(e) => handleMenuOpen(e, q.id)}>
                        <MoreVertIcon />
                      </IconButton>
                    <Menu
                        anchorEl={anchorElById[q.id]}
                        open={Boolean(anchorElById[q.id])}
                        onClose={() => handleMenuClose(q.id)}
                      >
                        <MenuItem
                          onClick={() => {
                            navigate(`/admin/questions/edit/${q.id}`);
                            handleMenuClose(q.id);
                          }}
                        >
                          Sửa
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            handleDeleteOne(q.id);
                            handleMenuClose(q.id);
                          }}
                        >
                          Xóa
                        </MenuItem>
                      </Menu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box px={2} pb={2} display="flex" justifyContent="flex-end">
          <TablePagination
            component="div"
            count={filteredQuestions.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </Box>
      </Card>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Xác nhận xoá câu hỏi"
        description="Bạn có chắc chắn muốn xoá câu hỏi này không?"
      />
    </Box>
    </>
  );
}
