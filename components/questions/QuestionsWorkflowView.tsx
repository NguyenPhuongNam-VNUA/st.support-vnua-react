'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Checkbox,
  IconButton,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  Tabs,
  Tab,
  Tooltip,
  TablePagination,
} from '@mui/material';
import {
  CheckCircle,
  XCircle,
  Edit3,
  Search,
  Filter,
  Trash2,
  Tag,
  GitCompare,
  History,
  CheckSquare,
  Upload,
  Plus,
  Save,
  MessageSquare,
} from 'lucide-react';
import SideBySideDuplicateModal from './SideBySideDuplicateModal';
import QuestionAuditLogDialog from './QuestionAuditLogDialog';

export const TOPIC_TAGS = ['Học vụ', 'Học phí', 'Ký túc xá', 'Tuyển sinh', 'Bảo lưu', 'Đồ án', 'Khác'];

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'Chờ duyệt', bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  approved: { label: 'Đã duyệt', bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  rejected: { label: 'Từ chối', bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  needs_edit: { label: 'Cần chỉnh sửa', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
};

const INITIAL_QUESTIONS = [
  {
    id: 1,
    question: 'Điểm chuẩn ngành Công nghệ thông tin năm 2025 là bao nhiêu?',
    answer: 'Điểm chuẩn ngành CNTT năm 2024 là 21.5 điểm theo phương thức xét học bạ THPT.',
    topic: 'Tuyển sinh',
    status: 'pending',
    duplicate_score: 92.5,
    existing_doc: 'Điểm chuẩn ngành CNTT năm 2024?',
    created_at: '09/08/2026 10:15',
  },
  {
    id: 2,
    question: 'Quy định mức đóng học phí tín chỉ lý thuyết và thực hành năm 2025?',
    answer: 'Học phí môn đại cương là 450.000đ/tín chỉ, môn chuyên ngành là 520.000đ/tín chỉ.',
    topic: 'Học phí',
    status: 'approved',
    duplicate_score: 0,
    created_at: '08/08/2026 14:30',
  },
  {
    id: 3,
    question: 'Thủ tục đăng ký tạm trú tạm vắng và ký túc xá khoa CNTT?',
    answer: 'Sinh viên nộp đơn đăng ký tại Ban Quản lý Ký túc xá nhà N1 kèm bản sao CCCD.',
    topic: 'Ký túc xá',
    status: 'needs_edit',
    duplicate_score: 76.0,
    existing_doc: 'Đăng ký phòng ký túc xá ở đâu?',
    created_at: '08/08/2026 11:20',
  },
  {
    id: 4,
    question: 'Hồ sơ xin hoãn thi kết thúc học kỳ 1 cần những giấy tờ gì?',
    answer: 'Cần đơn xin hoãn thi, giấy chứng nhận y tế hoặc lý do chính đáng nộp về Ban Quản lý Đào tạo.',
    topic: 'Học vụ',
    status: 'pending',
    duplicate_score: 0,
    created_at: '07/08/2026 16:45',
  },
];

export default function QuestionsWorkflowView() {
  const [questions, setQuestions] = useState<any[]>(INITIAL_QUESTIONS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentTab, setCurrentTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modals state
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedCompareQuestion, setSelectedCompareQuestion] = useState<any>(null);

  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedAuditQuestion, setSelectedAuditQuestion] = useState<any>(null);

  // New Question Inline Add State
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newAnswerText, setNewAnswerText] = useState('');
  const [newTopic, setNewTopic] = useState('Học vụ');

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesTab = currentTab === 'all' || q.status === currentTab;
      const matchesSearch =
        searchTerm === '' ||
        q.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.answer?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTopic = selectedTopic === '' || q.topic === selectedTopic;
      return matchesTab && matchesSearch && matchesTopic;
    });
  }, [questions, currentTab, searchTerm, selectedTopic]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredQuestions.map((q) => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Status transitions
  const handleChangeStatus = (id: number, newStatus: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: newStatus } : q))
    );
  };

  // Bulk actions
  const handleBulkStatusChange = (newStatus: string) => {
    setQuestions((prev) =>
      prev.map((q) => (selectedIds.includes(q.id) ? { ...q, status: newStatus } : q))
    );
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    setQuestions((prev) => prev.filter((q) => !selectedIds.includes(q.id)));
    setSelectedIds([]);
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    const newItem = {
      id: Date.now(),
      question: newQuestionText,
      answer: newAnswerText,
      topic: newTopic,
      status: 'pending',
      duplicate_score: 0,
      created_at: new Date().toLocaleString('vi-VN'),
    };
    setQuestions([newItem, ...questions]);
    setNewQuestionText('');
    setNewAnswerText('');
  };

  const openCompare = (q: any) => {
    setSelectedCompareQuestion(q);
    setCompareModalOpen(true);
  };

  const openAudit = (q: any) => {
    setSelectedAuditQuestion(q);
    setAuditModalOpen(true);
  };

  return (
    <Box>
      {/* Top Header & Action Tabs */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.02em' }}>
            Quản lý & Duyệt câu hỏi tri thức AI Agent
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Quy trình kiểm duyệt 4 bước: Chờ duyệt → Đã duyệt → Từ chối → Cần chỉnh sửa
          </Typography>
        </Box>

        {/* Quick Add Form Trigger */}
        <Button
          variant="contained"
          startIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            const el = document.getElementById('add-new-question-box');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          sx={{ borderRadius: '8px', backgroundColor: '#2563eb', fontWeight: 700, textTransform: 'none' }}
        >
          Thêm câu hỏi mới
        </Button>
      </Box>

      {/* Tabs Filter */}
      <Card sx={{ borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(_, val) => setCurrentTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            px: { xs: 1, sm: 2 },
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.875rem',
              py: 2,
              whiteSpace: 'nowrap',
            },
          }}
        >
          <Tab value="all" label={`Tất cả (${questions.length})`} />
          <Tab value="pending" label={`Chờ duyệt (${questions.filter((q) => q.status === 'pending').length})`} />
          <Tab value="approved" label={`Đã duyệt (${questions.filter((q) => q.status === 'approved').length})`} />
          <Tab value="needs_edit" label={`Cần chỉnh sửa (${questions.filter((q) => q.status === 'needs_edit').length})`} />
          <Tab value="rejected" label={`Từ chối (${questions.filter((q) => q.status === 'rejected').length})`} />
        </Tabs>

        {/* Search, Tag Filter & Bulk Action Toolbar */}
        <Box p={{ xs: 1.5, sm: 2 }} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5} flex={1} width="100%">
            <TextField
              size="small"
              placeholder="Tìm kiếm nội dung câu hỏi hoặc câu trả lời..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="w-4 h-4 text-slate-400" />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
              <Select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                displayEmpty
                sx={{ borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <MenuItem value="">Tất cả chủ đề</MenuItem>
                {TOPIC_TAGS.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Bulk Action Controls */}
          {selectedIds.length > 0 && (
            <Box display="flex" alignItems="center" gap={1} bgcolor="#edf4fc" p={1} border="1px solid #d0e2f7" sx={{ borderRadius: '8px' }}>
              <span className="text-xs font-bold text-[#2563eb]">Đã chọn {selectedIds.length} mục:</span>
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => handleBulkStatusChange('approved')}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.3 }}
              >
                Duyệt hàng loạt
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => handleBulkStatusChange('rejected')}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.3 }}
              >
                Từ chối hàng loạt
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleBulkDelete}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.3 }}
              >
                Xoá
              </Button>
            </Box>
          )}
        </Box>

        {/* Main Questions Table */}
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredQuestions.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569' }}>CÂU HỎI & CÂU TRẢ LỜI</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', width: 110 }}>CHỦ ĐỀ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', width: 120 }}>TRẠNG THÁI</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', width: 130 }}>TRÙNG LẶP %</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', width: 220 }}>HÀNH ĐỘNG DUYỆT</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredQuestions.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const statusInfo = STATUS_CONFIG[row.status] || STATUS_CONFIG.pending;
                return (
                  <TableRow key={row.id} hover selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={() => handleSelectOne(row.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" fontWeight={700} color="slate.900" sx={{ fontSize: '0.85rem' }}>
                        {row.question}
                      </Typography>
                      <Typography variant="body2" color="slate.600" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                        {row.answer}
                      </Typography>
                      <span className="text-[11px] text-slate-400 font-medium">Tạo lúc: {row.created_at}</span>
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label={row.topic}
                        size="small"
                        sx={{
                          borderRadius: '9999px',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: 'none',
                        }}
                      />
                    </TableCell>

                    <TableCell align="center">
                      <span
                        className="text-xs font-extrabold"
                        style={{
                          color: statusInfo.text,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </TableCell>

                    <TableCell align="center">
                      {row.duplicate_score > 0 ? (
                        <Tooltip title="Click để xem so sánh side-by-side">
                          <Chip
                            icon={<GitCompare className="w-3 h-3" />}
                            label={`${row.duplicate_score}%`}
                            onClick={() => openCompare(row)}
                            size="small"
                            sx={{
                              borderRadius: '9999px',
                              fontWeight: 800,
                              fontSize: '0.7rem',
                              backgroundColor: row.duplicate_score >= 85 ? '#fef2f2' : '#fffbe0',
                              color: row.duplicate_score >= 85 ? '#dc2626' : '#d97706',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>

                    <TableCell align="right">
                      <Box display="flex" justifyContent="flex-end" gap={0.5}>
                        <Tooltip title="Duyệt câu hỏi">
                          <IconButton
                            size="small"
                            onClick={() => handleChangeStatus(row.id, 'approved')}
                            sx={{ color: '#059669', '&:hover': { backgroundColor: '#ecfdf5' } }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Từ chối">
                          <IconButton
                            size="small"
                            onClick={() => handleChangeStatus(row.id, 'rejected')}
                            sx={{ color: '#dc2626', '&:hover': { backgroundColor: '#fff1f2' } }}
                          >
                            <XCircle className="w-4 h-4" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Yêu cầu sửa">
                          <IconButton
                            size="small"
                            onClick={() => handleChangeStatus(row.id, 'needs_edit')}
                            sx={{ color: '#2563eb', '&:hover': { backgroundColor: '#eff6ff' } }}
                          >
                            <Edit3 className="w-4 h-4" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Xem Audit Log">
                          <IconButton size="small" onClick={() => openAudit(row)}>
                            <History className="w-4 h-4 text-purple-600" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* Quick Add Inline Card */}
        <Card id="add-new-question-box" sx={{ borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', p: 3, mt: 4 }}>
          <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', mb: 2 }}>
            Thêm câu hỏi mới vào quy trình duyệt
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                size="small"
                label="Nội dung câu hỏi"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
              <FormControl size="small" sx={{ width: 180 }}>
                <Select
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  sx={{ borderRadius: '8px' }}
                >
                  {TOPIC_TAGS.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              size="small"
              label="Câu trả lời chuẩn cho Agent"
              value={newAnswerText}
              onChange={(e) => setNewAnswerText(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            <Box display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={<Save className="w-4 h-4" />}
                onClick={handleAddQuestion}
                sx={{ borderRadius: '8px', backgroundColor: '#2563eb', fontWeight: 700, textTransform: 'none' }}
              >
                Lưu vào danh sách chờ duyệt
              </Button>
            </Box>
          </Box>
        </Card>

        {/* Side-by-side Duplicate Modal */}
        <SideBySideDuplicateModal
          open={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          newQuestion={selectedCompareQuestion}
          existingQuestion={selectedCompareQuestion}
          similarityScore={selectedCompareQuestion?.duplicate_score || 88.5}
          onResolveAction={(action) => {
            console.log('Action chosen:', action);
            setCompareModalOpen(false);
          }}
        />

        {/* Audit Log Dialog */}
        <QuestionAuditLogDialog
          open={auditModalOpen}
          onClose={() => setAuditModalOpen(false)}
          questionText={selectedAuditQuestion?.question}
        />
      </Box>
  );
}
