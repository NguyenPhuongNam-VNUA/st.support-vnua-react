'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Typography,
  Card,
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
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  Tabs,
  Tab,
  TablePagination,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  CircleAlert,
  CheckCircle,
  XCircle,
  Edit3,
  Search,
  History,
  Plus,
  Save,
  GitCompare,
  FileSpreadsheet,
  MessageSquarePlus,
} from 'lucide-react';
import { ConfigurationPlaybookIcon } from '@/components/icons/SidebarIcons';
import SideBySideDuplicateModal from './SideBySideDuplicateModal';
import QuestionAuditLogDialog from './QuestionAuditLogDialog';
import QuestionEditDialog from './QuestionEditDialog';
import questionApi from '@/api/admin/questionApi';
import questionsExcelApi from '@/api/admin/questionsExcelApi';

export const TOPIC_TAGS = ['Học vụ', 'Học phí', 'Ký túc xá', 'Tuyển sinh', 'Bảo lưu', 'Đồ án', 'Khác'];

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'Chờ duyệt', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  approved: { label: 'Đã duyệt', bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  rejected: { label: 'Từ chối', bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  needs_edit: { label: 'Cần chỉnh sửa', bg: '#f0fdf4', text: '#006837', border: '#a7f3d0' },
};

interface QuestionRow {
  id: number;
  question: string;
  answer: string | null;
  topic: string | null;
  status: string;
  duplicate_score: number;
  created_at: string;
  [key: string]: unknown;
}

const EMPTY_STATUS_COUNTS = { all: 0, pending: 0, approved: 0, needs_edit: 0, rejected: 0 };
const EMPTY_ANSWER_COUNTS = { answered: 0, unanswered: 0 };

export default function QuestionsWorkflowView() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentTab, setCurrentTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [answerFilter, setAnswerFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState(EMPTY_STATUS_COUNTS);
  const [answerCounts, setAnswerCounts] = useState(EMPTY_ANSWER_COUNTS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionQuestionId, setActionQuestionId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Modals state
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedCompareQuestion, setSelectedCompareQuestion] = useState<any>(null);

  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedAuditQuestion, setSelectedAuditQuestion] = useState<any>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEditQuestion, setSelectedEditQuestion] = useState<QuestionRow | null>(null);

  // New Question Inline Add State
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newAnswerText, setNewAnswerText] = useState('');
  const [newTopic, setNewTopic] = useState('Học vụ');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(0);
      setSelectedIds([]);
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadQuestions = useCallback(async (active: () => boolean = () => true) => {
    setLoading(true);
    try {
      const response: any = await questionApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        ...(currentTab !== 'all' && { status: currentTab }),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(selectedTopic && { topic: selectedTopic }),
        ...(answerFilter !== 'all' && { answer: answerFilter }),
      });
      if (!active()) return;
      const result = response?.data || {};
      const rows = result.questions || [];
      setQuestions(rows);
      setTotal(result.total || 0);
      setStatusCounts(result.statusCounts || EMPTY_STATUS_COUNTS);
      setAnswerCounts(result.answerCounts || EMPTY_ANSWER_COUNTS);
      setApiError(null);
      if (page > 0 && rows.length === 0 && (result.total || 0) > 0) setPage((value) => value - 1);
    } catch (error: any) {
      if (active()) setApiError(error?.response?.data?.message || 'Không thể tải danh sách câu hỏi');
    } finally {
      if (active()) setLoading(false);
    }
  }, [answerFilter, currentTab, debouncedSearch, page, rowsPerPage, selectedTopic]);

  useEffect(() => {
    let active = true;
    loadQuestions(() => active);
    return () => { active = false; };
  }, [loadQuestions, refreshKey]);

  const refreshQuestions = () => setRefreshKey((value) => value + 1);

  const selectedQuestions = useMemo(
    () => questions.filter((question) => selectedIds.includes(question.id)),
    [questions, selectedIds]
  );
  const hasSelectedUnanswered = selectedQuestions.some((question) => !question.answer?.trim());

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(questions.map((q) => q.id));
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
  const handleChangeStatus = async (id: number, newStatus: string) => {
    setActionQuestionId(id);
    try {
      await questionApi.update(id, { status: newStatus });
      setSuccessMessage('Cập nhật trạng thái thành công');
      setApiError(null);
      refreshQuestions();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setActionQuestionId(null);
    }
  };

  // Bulk actions
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await questionApi.bulkUpdate(selectedIds, newStatus);
      setSelectedIds([]);
      setSuccessMessage('Cập nhật hàng loạt thành công');
      setApiError(null);
      refreshQuestions();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể cập nhật hàng loạt');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || !window.confirm(`Xóa ${selectedIds.length} câu hỏi đã chọn?`)) return;
    setBulkLoading(true);
    try {
      await questionApi.bulkDelete(selectedIds);
      setSelectedIds([]);
      setSuccessMessage('Xóa câu hỏi thành công');
      setApiError(null);
      refreshQuestions();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể xóa câu hỏi');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) return;
    try {
      await questionApi.add({
        question: newQuestionText,
        answer: newAnswerText,
        topic: newTopic,
        status: 'pending',
      });
      setNewQuestionText('');
      setNewAnswerText('');
      setCurrentTab('pending');
      setAnswerFilter(newAnswerText.trim() ? 'answered' : 'unanswered');
      setSelectedTopic('');
      setSearchTerm('');
      setPage(0);
      setSuccessMessage('Thêm câu hỏi thành công');
      setApiError(null);
      refreshQuestions();
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể tạo câu hỏi');
    }
  };

  const openCompare = (q: any) => {
    setSelectedCompareQuestion(q);
    setCompareModalOpen(true);
  };

  const openAudit = (q: any) => {
    setSelectedAuditQuestion(q);
    setAuditModalOpen(true);
  };

  const openEdit = (question: QuestionRow) => {
    setSelectedEditQuestion(question);
    setEditModalOpen(true);
  };

  const handleExcelImport = async (file?: File) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      await questionsExcelApi.upload(formData);
      setPage(0);
      setSuccessMessage('Nhập câu hỏi từ Excel thành công');
      refreshQuestions();
      setApiError(null);
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Không thể nhập file Excel');
    }
  };

  return (
    <Box>
      {apiError && <Alert severity="error" onClose={() => setApiError(null)} sx={{ mb: 2 }}>{apiError}</Alert>}
      {successMessage && <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ mb: 2 }}>{successMessage}</Alert>}
      {/* Top Header & Action Tabs */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          {/* Custom SVG Icon Placed Directly without Div Wrapper */}
          <ConfigurationPlaybookIcon size={42} className="text-[#0d8a4f] flex-shrink-0 transition-transform hover:scale-105" />
          <Box>
            <Typography variant="h5" fontWeight={900} sx={{ color: '#0d8a4f', letterSpacing: '-0.02em', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
              Quản Lý & Kiểm Duyệt Tri Thức Hỏi - Đáp
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Quy trình kiểm duyệt chuẩn hóa: Chờ duyệt → Đã duyệt → Cần chỉnh sửa → Từ chối
            </Typography>
          </Box>
        </Box>

        {/* Quick Add / Excel Import */}
        <Box display="flex" gap={1.2} flexWrap="wrap">
        <Button
          component="label"
          variant="outlined"
          startIcon={<FileSpreadsheet className="w-4 h-4" />}
          sx={{ borderRadius: '10px', fontWeight: 700, textTransform: 'none', px: 2.2 }}
        >
          Nhập Excel
          <input
            hidden
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              handleExcelImport(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </Button>
        <Button
          variant="contained"
          startIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            const el = document.getElementById('add-new-question-box');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          sx={{
            borderRadius: '10px',
            backgroundColor: '#0d8a4f',
            fontWeight: 700,
            textTransform: 'none',
            px: 2.5,
            py: 0.8,
            boxShadow: '0 4px 14px rgba(13, 138, 79, 0.2)',
            '&:hover': { backgroundColor: '#0a7543' },
          }}
        >
          Thêm câu hỏi mới
        </Button>
        </Box>
      </Box>

      {/* Tabs Filter Card */}
      <Card className="emerald-card" sx={{ p: 0, bgcolor: '#ffffff', mb: 3 }}>
        {loading && <LinearProgress aria-label="Đang tải danh sách câu hỏi" sx={{ bgcolor: '#d1fae5', '& .MuiLinearProgress-bar': { bgcolor: '#0d8a4f' } }} />}
        <Tabs
          value={currentTab}
          onChange={(_, value) => {
            setCurrentTab(value);
            setPage(0);
            setSelectedIds([]);
          }}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            px: { xs: 1, sm: 2 },
            borderBottom: '1px solid rgba(13, 138, 79, 0.08)',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.875rem',
              py: 1.8,
              color: '#475569',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              '&.Mui-selected': {
                color: '#0d8a4f',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#0d8a4f',
              height: '3px',
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab value="all" label={`Tất cả (${statusCounts.all})`} />
          <Tab value="pending" label={`Chờ duyệt (${statusCounts.pending})`} />
          <Tab value="approved" label={`Đã duyệt (${statusCounts.approved})`} />
          <Tab value="needs_edit" label={`Cần chỉnh sửa (${statusCounts.needs_edit})`} />
          <Tab value="rejected" label={`Từ chối (${statusCounts.rejected})`} />
        </Tabs>

        {/* Search, Tag Filter & Bulk Action Toolbar */}
        <Box p={{ xs: 1.5, sm: 2 }} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5} flex={1} width="100%">
            <TextField
              size="small"
              placeholder="Tìm kiếm nội dung câu hỏi hoặc đáp án tri thức..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="w-4 h-4 text-slate-400" />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                flex: 1, 
                '& .MuiOutlinedInput-root': { 
                  borderRadius: '12px', 
                  bgcolor: '#fbfdfc',
                  '& fieldset': { borderColor: 'rgba(0, 60, 30, 0.08)' },
                  '&:hover fieldset': { borderColor: 'rgba(0, 104, 55, 0.25)' },
                  '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(0, 104, 55, 0.12)' },
                  '&.Mui-focused fieldset': { borderColor: '#006837' }
                } 
              }}
            />

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
              <Select
                value={selectedTopic}
                onChange={(event) => {
                  setSelectedTopic(event.target.value);
                  setPage(0);
                  setSelectedIds([]);
                }}
                displayEmpty
                sx={{ 
                  borderRadius: '12px', 
                  fontSize: '0.85rem',
                  bgcolor: '#fbfdfc',
                  '& fieldset': { borderColor: 'rgba(0, 60, 30, 0.08)' },
                  '&:hover fieldset': { borderColor: 'rgba(0, 104, 55, 0.25)' },
                  '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(0, 104, 55, 0.12)' },
                  '&.Mui-focused fieldset': { borderColor: '#006837' }
                }}
              >
                <MenuItem value="">Tất cả chủ đề</MenuItem>
                {TOPIC_TAGS.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <ToggleButtonGroup
              exclusive
              size="small"
              value={answerFilter}
              onChange={(_, value) => {
                if (!value) return;
                setAnswerFilter(value);
                setPage(0);
                setSelectedIds([]);
              }}
              aria-label="Lọc theo tình trạng câu trả lời"
              sx={{
                alignSelf: { xs: 'stretch', sm: 'center' },
                '& .MuiToggleButton-root': {
                  px: 1.5,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 750,
                  whiteSpace: 'nowrap',
                  borderColor: 'rgba(0, 60, 30, 0.1)',
                  '&.Mui-selected': { color: '#006837', bgcolor: '#ecfdf5' },
                },
              }}
            >
              <ToggleButton value="all">Tất cả đáp án ({answerCounts.answered + answerCounts.unanswered})</ToggleButton>
              <ToggleButton value="unanswered">Chưa có ({answerCounts.unanswered})</ToggleButton>
              <ToggleButton value="answered">Đã có ({answerCounts.answered})</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Bulk Action Controls */}
          {selectedIds.length > 0 && (
            <Box display="flex" alignItems="center" gap={1} bgcolor="#ecfdf5" p={1} border="1px solid rgba(16, 185, 129, 0.3)" sx={{ borderRadius: '12px', boxShadow: '0 0 0 1px rgba(255,255,255,0.8) inset' }}>
              <span className="text-xs font-black text-[#006837]">Đã chọn {selectedIds.length} mục:</span>
              <Tooltip title={hasSelectedUnanswered ? 'Hãy thêm câu trả lời cho các câu hỏi đã chọn trước khi duyệt' : 'Duyệt các câu hỏi đã chọn'}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={bulkLoading || hasSelectedUnanswered}
                    onClick={() => handleBulkStatusChange('approved')}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800, fontSize: '0.75rem', py: 0.4, bgcolor: '#006837', '&:hover': { bgcolor: '#00562e' } }}
                  >
                    Duyệt hàng loạt
                  </Button>
                </span>
              </Tooltip>
              <Button
                size="small"
                variant="contained"
                disabled={bulkLoading}
                onClick={() => handleBulkStatusChange('rejected')}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800, fontSize: '0.75rem', py: 0.4, bgcolor: '#e11d48', '&:hover': { bgcolor: '#be123c' } }}
              >
                Từ chối hàng loạt
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={bulkLoading}
                onClick={handleBulkDelete}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800, fontSize: '0.75rem', py: 0.4, borderColor: '#e11d48', color: '#e11d48', '&:hover': { bgcolor: '#fff1f2' } }}
              >
                Xoá
              </Button>
            </Box>
          )}
        </Box>

        {/* Main Questions Table */}
        <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead sx={{ backgroundColor: '#fafdfb' }}>
              <TableRow>
                <TableCell padding="checkbox" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>
                  <Checkbox
                    size="small"
                    checked={questions.length > 0 && selectedIds.length === questions.length}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < questions.length}
                    onChange={handleSelectAll}
                    inputProps={{ 'aria-label': 'Chọn tất cả câu hỏi trên trang này' }}
                    sx={{ color: '#0d8a4f', '&.Mui-checked': { color: '#0d8a4f' } }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>CÂU HỎI & CÂU TRẢ LỜI</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', width: 110, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>CHỦ ĐỀ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', width: 120, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>TRẠNG THÁI</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', width: 130, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>TRÙNG LẶP %</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#0d8a4f', width: 260, borderBottom: '1px solid rgba(13, 138, 79, 0.08)' }}>HÀNH ĐỘNG</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {questions.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const statusInfo = STATUS_CONFIG[row.status] || STATUS_CONFIG.pending;
                const hasAnswer = Boolean(row.answer?.trim());
                const actionLoading = actionQuestionId === row.id;
                return (
                  <TableRow 
                    key={row.id} 
                    hover 
                    selected={isSelected}
                    sx={{
                      transition: 'background-color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      '&:hover': { bgcolor: '#f0f8f4 !important' },
                      '&:last-child td': { borderBottom: 0 },
                    }}
                  >
                    <TableCell padding="checkbox" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={() => handleSelectOne(row.id)}
                        inputProps={{ 'aria-label': `Chọn câu hỏi #${row.id}` }}
                        sx={{ color: '#0d8a4f', '&.Mui-checked': { color: '#0d8a4f' } }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                      <Typography variant="body2" fontWeight={800} color="#0f291e" sx={{ fontSize: '0.875rem' }}>
                        {row.question}
                      </Typography>
                      {hasAnswer ? (
                        <Typography variant="body2" color="slate.600" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                          {row.answer}
                        </Typography>
                      ) : (
                        <Chip
                          icon={<MessageSquarePlus size={14} aria-hidden="true" />}
                          label="Chưa có câu trả lời"
                          size="small"
                          onClick={() => openEdit(row)}
                          sx={{ mt: 0.75, color: '#c2410c', bgcolor: '#fff7ed', border: '1px solid #fed7aa', fontWeight: 800, cursor: 'pointer' }}
                        />
                      )}
                      <Typography component="span" display="block" sx={{ mt: 0.5, fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 500 }}>
                        Tạo lúc: {new Date(row.created_at).toLocaleString('vi-VN')}
                      </Typography>
                    </TableCell>

                    <TableCell align="center" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                      <Chip
                        label={row.topic}
                        size="small"
                        sx={{
                          borderRadius: '9999px',
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          backgroundColor: '#f0f8f4',
                          color: '#0d8a4f',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                        }}
                      />
                    </TableCell>

                    <TableCell align="center" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                      <span
                        className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full inline-block border shadow-2xs"
                        style={{
                          color: statusInfo.text,
                          backgroundColor: statusInfo.bg,
                          borderColor: statusInfo.border,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </TableCell>

                    <TableCell align="center" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                      {row.duplicate_score > 0 ? (
                        <Tooltip title="Click để xem so sánh side-by-side">
                          <Chip
                            icon={<GitCompare className="w-3 h-3" aria-hidden="true" />}
                            label={`${row.duplicate_score}%`}
                            onClick={() => openCompare(row)}
                            size="small"
                            sx={{
                              borderRadius: '9999px',
                              fontWeight: 800,
                              fontSize: '0.7rem',
                              backgroundColor: row.duplicate_score >= 85 ? '#fff1f2' : '#fffbeb',
                              color: row.duplicate_score >= 85 ? '#be123c' : '#b45309',
                              border: `1px solid ${row.duplicate_score >= 85 ? 'rgba(244, 63, 94, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                              cursor: 'pointer',
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">—</span>
                      )}
                    </TableCell>

                    <TableCell align="right" sx={{ borderBottom: '1px solid rgba(13, 138, 79, 0.04)' }}>
                      <Box display="flex" justifyContent="flex-end" gap={0.5}>
                        <Tooltip title={hasAnswer ? 'Duyệt câu hỏi' : 'Chưa thể duyệt khi chưa có câu trả lời'}>
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Duyệt câu hỏi #${row.id}`}
                              disabled={!hasAnswer || row.status === 'approved' || actionLoading}
                              onClick={() => handleChangeStatus(row.id, 'approved')}
                              sx={{ color: '#0d8a4f', borderRadius: '8px', '&:hover': { backgroundColor: '#f0f8f4' } }}
                            >
                              <CheckCircle className="w-4 h-4" aria-hidden="true" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Từ chối">
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Từ chối câu hỏi #${row.id}`}
                              disabled={row.status === 'rejected' || actionLoading}
                              onClick={() => handleChangeStatus(row.id, 'rejected')}
                              sx={{ color: '#be123c', borderRadius: '8px', '&:hover': { backgroundColor: '#fff1f2' } }}
                            >
                              <XCircle className="w-4 h-4" aria-hidden="true" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Đánh dấu cần chỉnh sửa">
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Đánh dấu câu hỏi #${row.id} cần chỉnh sửa`}
                              disabled={row.status === 'needs_edit' || actionLoading}
                              onClick={() => handleChangeStatus(row.id, 'needs_edit')}
                              sx={{ color: '#b45309', borderRadius: '8px', '&:hover': { backgroundColor: '#fffbeb' } }}
                            >
                              <CircleAlert className="w-4 h-4" aria-hidden="true" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title={hasAnswer ? 'Sửa câu hỏi và câu trả lời' : 'Thêm câu trả lời'}>
                          <IconButton
                            size="small"
                            aria-label={hasAnswer ? `Sửa câu hỏi #${row.id}` : `Thêm câu trả lời cho câu hỏi #${row.id}`}
                            onClick={() => openEdit(row)}
                            sx={{ color: hasAnswer ? '#2563eb' : '#c2410c', borderRadius: '8px', '&:hover': { backgroundColor: hasAnswer ? '#eff6ff' : '#fff7ed' } }}
                          >
                            {hasAnswer ? <Edit3 className="w-4 h-4" aria-hidden="true" /> : <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />}
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Xem lịch sử thay đổi">
                          <IconButton
                            size="small"
                            aria-label={`Xem lịch sử thay đổi câu hỏi #${row.id}`}
                            onClick={() => openAudit(row)}
                            sx={{ color: '#64748b', borderRadius: '8px', '&:hover': { backgroundColor: '#f8fafc' } }}
                          >
                            <History className="w-4 h-4" aria-hidden="true" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && questions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 7, color: 'text.secondary' }}>
                    <MessageSquarePlus size={30} aria-hidden="true" />
                    <Typography mt={1} fontWeight={700}>Không có câu hỏi phù hợp bộ lọc.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, nextPage) => {
            setPage(nextPage);
            setSelectedIds([]);
          }}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
            setSelectedIds([]);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Số dòng/trang:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          sx={{ borderTop: '1px solid rgba(13, 138, 79, 0.08)' }}
        />
      </Card>

      {/* Quick Add Inline Card */}
      <Card id="add-new-question-box" className="emerald-card" sx={{ p: 3.5, bgcolor: '#ffffff', mt: 4 }}>
        <Typography variant="h6" fontWeight={800} sx={{ color: '#0d8a4f', mb: 2 }}>
          Thêm câu hỏi mới vào quy trình duyệt tri thức
        </Typography>
        <Box display="flex" flexDirection="column" gap={2}>
          <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
            <TextField
              fullWidth
              size="small"
              label="Nội dung câu hỏi"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              sx={{ 
                '& .MuiOutlinedInput-root': { 
                  borderRadius: '12px',
                  bgcolor: '#fbfdfc',
                  '& fieldset': { borderColor: 'rgba(13, 138, 79, 0.08)' },
                  '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.28)' },
                  '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)' },
                  '&.Mui-focused fieldset': { borderColor: '#0d8a4f' }
                } 
              }}
            />
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 200 } }}>
              <Select
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                sx={{ 
                  borderRadius: '12px',
                  bgcolor: '#fbfdfc',
                  '& fieldset': { borderColor: 'rgba(13, 138, 79, 0.08)' },
                  '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.28)' },
                  '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)' },
                  '&.Mui-focused fieldset': { borderColor: '#0d8a4f' }
                }}
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
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                borderRadius: '12px',
                bgcolor: '#fbfdfc',
                '& fieldset': { borderColor: 'rgba(13, 138, 79, 0.08)' },
                '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.28)' },
                '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)' },
                '&.Mui-focused fieldset': { borderColor: '#0d8a4f' }
              } 
            }}
          />

          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={<Save className="w-4 h-4" />}
              onClick={handleAddQuestion}
              sx={{ 
                borderRadius: '10px', 
                backgroundColor: '#0d8a4f', 
                fontWeight: 700, 
                textTransform: 'none',
                px: 3,
                py: 0.9,
                boxShadow: '0 4px 12px rgba(13, 138, 79, 0.2)',
                '&:hover': { backgroundColor: '#0a7543' }
              }}
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
        questionId={selectedAuditQuestion?.id}
        questionText={selectedAuditQuestion?.question}
      />

      <QuestionEditDialog
        open={editModalOpen}
        question={selectedEditQuestion}
        topics={TOPIC_TAGS}
        onClose={() => setEditModalOpen(false)}
        onSaved={() => {
          setEditModalOpen(false);
          setSuccessMessage('Lưu thay đổi câu hỏi thành công');
          refreshQuestions();
        }}
      />
    </Box>
  );
}
