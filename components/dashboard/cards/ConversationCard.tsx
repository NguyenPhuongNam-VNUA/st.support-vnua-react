import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Box,
  Tooltip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  TablePagination,
  Grid,
} from "@mui/material";
import { MessageSquareText, Clock, Search, Filter, CheckCircle2, AlertCircle, Cpu, PieChart } from 'lucide-react';
import { styled } from "@mui/material/styles";
import conversationApi from "@/api/chatbot/conversationApi";

const StyledCard = styled(Card)(() => ({
  borderRadius: 0,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
  border: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
  overflow: 'hidden',
}));

const StyledTableHead = styled(TableHead)(() => ({
  '& .MuiTableCell-head': {
    backgroundColor: '#f8fafc',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
}));

const StyledTableRow = styled(TableRow)(() => ({
  transition: 'background-color 0.15s ease',
  '&:hover': {
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
  },
  '& .MuiTableCell-root': {
    borderBottom: '1px solid #f1f5f9',
    padding: '14px 16px',
    fontSize: '0.875rem',
  },
}));

const AppleTextField = styled(TextField)(() => ({
  '& .MuiOutlinedInput-root': {
    height: '42px',
    borderRadius: 0,
    backgroundColor: '#f8fafc',
    fontSize: '0.875rem',
    transition: 'all 0.2s ease',
    '& fieldset': {
      borderColor: '#e2e8f0',
    },
    '&:hover fieldset': {
      borderColor: '#cbd5e1',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#2563eb',
      borderWidth: '1.5px',
    },
  },
}));

const AppleSelect = styled(Select)(() => ({
  height: '42px',
  borderRadius: 0,
  backgroundColor: '#f8fafc',
  fontSize: '0.875rem',
  '& fieldset': {
    borderColor: '#e2e8f0',
  },
  '&:hover fieldset': {
    borderColor: '#cbd5e1',
  },
  '&.Mui-focused fieldset': {
    borderColor: '#2563eb',
    borderWidth: '1.5px',
  },
}));

const StatusChip = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; text: string }> = {
    answered: { label: "Đã trả lời", text: "#059669" },
    not_found: { label: "Không tìm thấy", text: "#e11d48" },
    auto_generated: { label: "Tự sinh", text: "#d97706" },
    out_of_topic: { label: "Lạc đề", text: "#64748b" },
  };

  const item = config[status] || { label: status, text: "#64748b" };
  return (
    <span
      className="text-xs font-extrabold"
      style={{
        color: item.text,
      }}
    >
      {item.label}
    </span>
  );
};

const MOCK_LOGS = [
  {
    id: 1,
    question: "Điểm chuẩn ngành Công nghệ thông tin là bao nhiêu?",
    context: "Quy chế tuyển sinh VNUA 2025",
    answer: "Điểm chuẩn ngành CNTT năm 2024 là 21.5 điểm theo phương thức xét học bạ.",
    response_type: "answered",
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    question: "Học phí ngành Kỹ thuật phần mềm là bao nhiêu?",
    context: "Quy định học phí 2025",
    answer: "Học phí khoảng 450.000đ/tín chỉ đối với các môn đại cương.",
    response_type: "answered",
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    question: "Địa chỉ Ký túc xá khoa CNTT?",
    context: "",
    answer: "Chưa tìm thấy thông tin phù hợp trong cơ sở dữ liệu.",
    response_type: "not_found",
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    question: "Thời gian nộp hồ sơ xét tuyển trực tiếp?",
    context: "Thông báo tuyển sinh",
    answer: "Thời gian nhận hồ sơ từ 15/07/2025 đến 20/08/2025.",
    response_type: "auto_generated",
    created_at: new Date().toISOString()
  }
];

export default function ConversationCard({ activeFilter, noCardContainer = false }: { activeFilter?: string | null; noCardContainer?: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (activeFilter) {
      if (['answered', 'not_found', 'auto_generated', 'out_of_topic'].includes(activeFilter)) {
        setStatusFilter(activeFilter);
      } else if (activeFilter.startsWith('slot_')) {
        setSearchTerm(activeFilter.replace('slot_', ''));
      }
    }
  }, [activeFilter]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res: any = await conversationApi.getAll();
        const rawData = (res && Array.isArray(res.data) && res.data.length > 0) ? res.data : MOCK_LOGS;

        setLogs(
          rawData.map((item: any) => ({
            id: item.id,
            question: item.question,
            context: item.context,
            answer: item.answer,
            status: item.response_type || item.status || 'answered',
            created_at: new Date(item.created_at || Date.now()).toLocaleString("vi-VN", {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
          }))
        );
      } catch (err) {
        console.warn("Lỗi khi lấy logs (dùng dữ liệu mẫu):", err);
        setLogs(
          MOCK_LOGS.map((item: any) => ({
            id: item.id,
            question: item.question,
            context: item.context,
            answer: item.answer,
            status: item.response_type,
            created_at: new Date(item.created_at).toLocaleString("vi-VN", {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = searchTerm === '' || 
        log.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.answer?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === '' || log.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

  const paginatedLogs = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredLogs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredLogs, page, rowsPerPage]);

  const stats = useMemo(() => {
    const total = logs.length;
    const answered = logs.filter(log => log.status === 'answered').length;
    const notFound = logs.filter(log => log.status === 'not_found').length;
    const autoGenerated = logs.filter(log => log.status === 'auto_generated').length;
    
    return { total, answered, notFound, autoGenerated };
  }, [logs]);

  const truncate = (text: string, maxLength = 60) =>
    text?.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  const handleChangePage = (_: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: any) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box sx={noCardContainer ? {} : { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)' }}>
      {/* Header */}
      <CardHeader
        title={
          <Box display="flex" alignItems="center" justifyContent="space-between" py={0.5}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <MessageSquareText className="w-6 h-6 text-[#2563eb]" />
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Nhật ký hội thoại Chatbot
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  Quản lý và theo dõi chi tiết tất cả các cuộc hội thoại
                </Typography>
              </Box>
            </Box>

            {/* Total Pill Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1">
              <span className="text-xs font-bold text-slate-500">Tổng cộng:</span>
              <span className="text-sm font-extrabold text-[#2563eb]">{logs.length}</span>
            </div>
          </Box>
        }
        sx={{ p: noCardContainer ? 0 : 3, pb: 2 }}
      />
      
      <Box sx={{ px: noCardContainer ? 0 : 3, pb: noCardContainer ? 0 : 3, pt: 0 }}>
        {/* Square Stat Cards Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <div className="p-4 rounded-none bg-emerald-50/70 border border-emerald-100/80 transition-all hover:shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <Typography variant="caption" fontWeight={700} sx={{ color: '#047857' }}>
                  Đã trả lời
                </Typography>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#059669', letterSpacing: '-0.03em' }}>
                {stats.answered}
              </Typography>
            </div>
          </Grid>

          <Grid item xs={6} sm={3}>
            <div className="p-4 rounded-none bg-rose-50/70 border border-rose-100/80 transition-all hover:shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <Typography variant="caption" fontWeight={700} sx={{ color: '#be123c' }}>
                  Không tìm thấy
                </Typography>
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#e11d48', letterSpacing: '-0.03em' }}>
                {stats.notFound}
              </Typography>
            </div>
          </Grid>

          <Grid item xs={6} sm={3}>
            <div className="p-4 rounded-none bg-amber-50/70 border border-amber-100/80 transition-all hover:shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <Typography variant="caption" fontWeight={700} sx={{ color: '#b45309' }}>
                  Tự sinh
                </Typography>
                <Cpu className="w-4 h-4 text-amber-600" />
              </div>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#d97706', letterSpacing: '-0.03em' }}>
                {stats.autoGenerated}
              </Typography>
            </div>
          </Grid>

          <Grid item xs={6} sm={3}>
            <div className="p-4 rounded-none bg-[#edf4fc] border border-[#d0e2f7] transition-all hover:shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <Typography variant="caption" fontWeight={700} sx={{ color: '#2563eb' }}>
                  Tỷ lệ trả lời
                </Typography>
                <PieChart className="w-4 h-4 text-[#2563eb]" />
              </div>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#2563eb', letterSpacing: '-0.03em' }}>
                {((stats.answered / (stats.total || 1)) * 100).toFixed(1)}%
              </Typography>
            </div>
          </Grid>
        </Grid>

        {/* Search & Filter Controls */}
        <Box display="flex" gap={2} mb={3} flexWrap="wrap">
          <AppleTextField
            placeholder="Tìm kiếm nội dung câu hỏi hoặc câu trả lời..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="w-4 h-4 text-slate-400" />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 280 }}
          />
          
          <FormControl sx={{ minWidth: 170 }}>
            <AppleSelect
              value={statusFilter}
              onChange={(e: any) => { setStatusFilter(e.target.value); setPage(0); }}
              displayEmpty
              startAdornment={<Filter className="w-4 h-4 mr-2 text-slate-400" />}
            >
              <MenuItem value="">Tất cả trạng thái</MenuItem>
              <MenuItem value="answered">Đã trả lời</MenuItem>
              <MenuItem value="not_found">Không tìm thấy</MenuItem>
              <MenuItem value="auto_generated">Tự sinh</MenuItem>
              <MenuItem value="out_of_topic">Lạc đề</MenuItem>
            </AppleSelect>
          </FormControl>
        </Box>

        {/* Loading / Table view */}
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={8}>
            <CircularProgress size={40} sx={{ color: '#2563eb' }} />
            <Typography variant="body2" sx={{ mt: 2, color: "text.secondary", fontWeight: 500 }}>
              Đang tải dữ liệu...
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer 
              component={Paper} 
              elevation={0} 
              sx={{ 
                borderRadius: 0,
                border: '1px solid #e2e8f0',
                maxHeight: 520,
                overflow: 'auto'
              }}
            >
              <Table stickyHeader size="small">
                <StyledTableHead>
                  <TableRow>
                    <TableCell sx={{ width: 60 }} align="center">ID</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>Câu hỏi người dùng</TableCell>
                    <TableCell sx={{ minWidth: 150 }}>Ngữ cảnh</TableCell>
                    <TableCell sx={{ minWidth: 250 }}>Câu trả lời Chatbot</TableCell>
                    <TableCell align="center" sx={{ width: 140 }}>Trạng thái</TableCell>
                    <TableCell align="center" sx={{ width: 140 }}>Thời gian</TableCell>
                  </TableRow>
                </StyledTableHead>
                <TableBody>
                  {paginatedLogs.map((row) => (
                    <StyledTableRow key={row.id}>
                      <TableCell align="center">
                        <span className="font-extrabold text-[#2563eb] text-sm">
                          {row.id}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        <Tooltip title={row.question} arrow placement="top">
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600,
                              color: '#1e293b',
                              cursor: 'pointer',
                              '&:hover': { color: '#2563eb' }
                            }}
                          >
                            {truncate(row.question, 50)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      
                      <TableCell>
                        <Tooltip title={row.context || "Không có ngữ cảnh"} arrow placement="top">
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontStyle: 'italic', 
                              color: '#64748b',
                              fontSize: '0.8rem',
                              cursor: row.context ? 'pointer' : 'default'
                            }}
                          >
                            {truncate(row.context || "-", 35)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      
                      <TableCell>
                        <Tooltip title={row.answer} arrow placement="top">
                          <Typography 
                            variant="body2"
                            sx={{ cursor: 'pointer' }}
                          >
                            {truncate(row.answer, 60)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      
                      <TableCell align="center">
                        <StatusChip status={row.status} />
                      </TableCell>
                      
                      <TableCell align="center">
                        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <Typography variant="caption" fontWeight={500} color="text.secondary">
                            {row.created_at}
                          </Typography>
                        </Box>
                      </TableCell>
                    </StyledTableRow>
                  ))}
                  
                  {paginatedLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight={500}>
                          Không tìm thấy cuộc hội thoại phù hợp
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={filteredLogs.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Hiển thị:"
              labelDisplayedRows={({ from, to, count }) => 
                `${from}-${to} trong số ${count !== -1 ? count : `hơn ${to}`}`
              }
              sx={{
                borderTop: '1px solid #f1f5f9',
                '& .MuiTablePagination-toolbar': {
                  px: 2,
                },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  fontSize: '0.8rem',
                  color: '#64748b',
                  fontWeight: 500,
                },
              }}
            />
          </>
        )}
      </Box>
    </Box>
  );
}
