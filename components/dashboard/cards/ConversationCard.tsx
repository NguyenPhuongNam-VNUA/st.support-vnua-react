'use client';

import { useEffect, useState, useMemo } from "react";
import {
  CardHeader,
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
  Button,
} from "@mui/material";
import Grid from '@mui/material/Grid2';
import { MessageSquareText, Clock, Search, Filter, CheckCircle2, AlertCircle, Cpu, PieChart, X } from 'lucide-react';
import { styled } from "@mui/material/styles";
import conversationApi from "@/api/chatbot/conversationApi";

const StyledTableHead = styled(TableHead)(() => ({
  '& .MuiTableCell-head': {
    backgroundColor: '#f8f8f8',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#1f2937',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
}));

const StyledTableRow = styled(TableRow)(() => ({
  transition: 'background-color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
  '&:hover': {
    backgroundColor: '#f3f4f6 !important',
  },
  '& .MuiTableCell-root': {
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
    padding: '13px 16px',
    fontSize: '0.875rem',
  },
}));

const GreenTextField = styled(TextField)(() => ({
  '& .MuiOutlinedInput-root': {
    height: '42px',
    borderRadius: '12px',
    backgroundColor: '#f8f8f8',
    fontSize: '0.875rem',
    transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
    '& fieldset': {
      borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(0, 0, 0, 0.12)',
    },
    '&.Mui-focused': {
      boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.12)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#1f2937',
      borderWidth: '1.5px',
    },
  },
}));

const GreenSelect = styled(Select)(() => ({
  height: '42px',
  borderRadius: '12px',
  backgroundColor: '#f8f8f8',
  fontSize: '0.875rem',
  transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
  '& fieldset': {
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  '&:hover fieldset': {
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  '&.Mui-focused': {
    boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.12)',
  },
  '&.Mui-focused fieldset': {
    borderColor: '#1f2937',
    borderWidth: '1.5px',
  },
}));

const StatusChip = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; text: string; bg: string; border: string }> = {
    answered: { label: "Đã trả lời", text: "#1f2937", bg: "#f3f4f6", border: "rgba(0, 0, 0, 0.12)" },
    not_found: { label: "Không tìm thấy", text: "#ef4444", bg: "#f7f7f7", border: "rgba(0, 0, 0, 0.12)" },
    auto_generated: { label: "Tự sinh", text: "#4b5563", bg: "#f7f7f7", border: "rgba(0, 0, 0, 0.12)" },
    out_of_topic: { label: "Lạc đề", text: "#4b5563", bg: "#f3f4f6", border: "rgba(100, 116, 139, 0.2)" },
  };

  const item = config[status] || { label: status, text: "#4b5563", bg: "#f3f4f6", border: "rgba(100, 116, 139, 0.2)" };
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-block border shadow-2xs"
      style={{
        color: item.text,
        backgroundColor: item.bg,
        borderColor: item.border,
      }}
    >
      {item.label}
    </span>
  );
};

interface ConversationCardProps {
  activeFilter?: string | null;
  noCardContainer?: boolean;
  timeRange?: string;
  startDate?: string;
  endDate?: string;
}

export default function ConversationCard({
  activeFilter,
  noCardContainer = false,
  timeRange,
  startDate,
  endDate,
}: ConversationCardProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [slotFilter, setSlotFilter] = useState<{ day: string; hour: number } | null>(null);

  useEffect(() => {
    if (activeFilter) {
      if (['answered', 'not_found', 'auto_generated', 'out_of_topic'].includes(activeFilter)) {
        setStatusFilter(activeFilter);
        setSlotFilter(null);
        setPage(0);
      } else if (activeFilter.startsWith('slot_')) {
        const parts = activeFilter.split('_');
        if (parts.length >= 3) {
          const day = parts[1];
          const hour = parseInt(parts[2].replace('h', ''), 10);
          setSlotFilter({ day, hour });
          setPage(0);
        }
      }
    }
  }, [activeFilter]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res: any = await conversationApi.getAll();
        const rawData = res && Array.isArray(res.data) ? res.data : [];

        setLogs(
          rawData.map((item: any) => ({
            id: item.id,
            question: item.question,
            context: item.context,
            answer: item.answer,
            status: item.response_type || item.status || 'answered',
            rawDate: new Date(item.created_at || Date.now()),
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
        console.warn("Lỗi khi lấy logs:", err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const DAYS_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    return logs.filter((log) => {
      const matchesSearch =
        searchTerm === '' || 
        log.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.answer?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === '' || log.status === statusFilter;

      let matchesTime = true;
      if (timeRange === 'today') {
        matchesTime = log.rawDate >= startOfToday;
      } else if (timeRange === '7d') {
        matchesTime = log.rawDate >= sevenDaysAgo;
      } else if (timeRange === '30d') {
        matchesTime = log.rawDate >= thirtyDaysAgo;
      } else if (timeRange === 'custom') {
        if (startDate) {
          matchesTime = matchesTime && log.rawDate >= new Date(startDate);
        }
        if (endDate) {
          matchesTime = matchesTime && log.rawDate <= new Date(`${endDate}T23:59:59`);
        }
      }

      let matchesSlot = true;
      if (slotFilter) {
        const logDay = DAYS_VN[log.rawDate.getDay()];
        const logHour = log.rawDate.getHours();
        matchesSlot = logDay === slotFilter.day && logHour === slotFilter.hour;
      }
      
      return matchesSearch && matchesStatus && matchesTime && matchesSlot;
    });
  }, [logs, searchTerm, statusFilter, timeRange, startDate, endDate, slotFilter]);

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
    <Box 
      className={noCardContainer ? "" : "emerald-card"}
      sx={noCardContainer ? {} : { backgroundColor: '#ffffff', p: 0 }}
    >
      {/* Header - Only shown when in Dashboard card mode */}
      {!noCardContainer && (
        <CardHeader
          title={
            <Box display="flex" alignItems="center" justifyContent="space-between" py={0.5}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <MessageSquareText className="w-5 h-5 text-[#1f2937]" />
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ color: '#1f2937', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    Nhật ký hội thoại Chatbot & Tương tác thực tế
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    Quản lý và tra cứu chi tiết toàn bộ các phiên hội thoại sinh viên hỏi đáp AI
                  </Typography>
                </Box>
              </Box>

              {/* Total Pill Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-[#f3f4f6] border border-[#e5e7eb]/80 rounded-full">
                <span className="text-xs font-medium text-gray-600">Tổng cộng:</span>
                <span className="text-sm font-semibold text-[#1f2937]">{logs.length}</span>
              </div>
            </Box>
          }
          sx={{ p: 2.5, pb: 2 }}
        />
      )}
      
      <Box sx={{ px: noCardContainer ? 0 : 2.5, pb: noCardContainer ? 0 : 2.5, pt: 0 }}>
        {/* Apple Squircle Stat Cards Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <div className="p-3.5 rounded-xl bg-[#f3f4f6] border border-[#e5e7eb]/60 transition-all hover:shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <Typography variant="caption" fontWeight={600} sx={{ color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Đã trả lời
                </Typography>
                <CheckCircle2 className="w-4 h-4 text-[#059669]" />
              </div>
              <Typography variant="h4" fontWeight={600} sx={{ color: '#1f2937', letterSpacing: '-0.025em' }}>
                {stats.answered}
              </Typography>
            </div>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <div className="p-3.5 rounded-xl bg-[#f7f7f7] border border-[#e5e7eb] transition-all hover:shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <Typography variant="caption" fontWeight={600} sx={{ color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Không tìm thấy
                </Typography>
                <AlertCircle className="w-4 h-4 text-[#ef4444]" />
              </div>
              <Typography variant="h4" fontWeight={600} sx={{ color: '#ef4444', letterSpacing: '-0.025em' }}>
                {stats.notFound}
              </Typography>
            </div>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <div className="p-3.5 rounded-xl bg-[#f7f7f7] border border-[#e5e7eb] transition-all hover:shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <Typography variant="caption" fontWeight={600} sx={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Tự sinh
                </Typography>
                <Cpu className="w-4 h-4 text-[#4b5563]" />
              </div>
              <Typography variant="h4" fontWeight={600} sx={{ color: '#4b5563', letterSpacing: '-0.025em' }}>
                {stats.autoGenerated}
              </Typography>
            </div>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <div className="p-3.5 rounded-xl bg-[#f3f4f6] border border-[#e5e7eb]/60 transition-all hover:shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <Typography variant="caption" fontWeight={600} sx={{ color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Tỷ lệ trả lời
                </Typography>
                <PieChart className="w-4 h-4 text-[#1f2937]" />
              </div>
              <Typography variant="h4" fontWeight={600} sx={{ color: '#1f2937', letterSpacing: '-0.025em' }}>
                {((stats.answered / (stats.total || 1)) * 100).toFixed(1)}%
              </Typography>
            </div>
          </Grid>
        </Grid>

        {/* Search & Filter Controls */}
        <Box display="flex" gap={2} mb={3} flexWrap="wrap">
          <GreenTextField
            placeholder="Tìm kiếm nội dung câu hỏi hoặc câu trả lời..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="w-4 h-4 text-gray-400" />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 280 }}
          />
          
          <FormControl sx={{ minWidth: 170 }}>
            <GreenSelect
              value={statusFilter}
              onChange={(e: any) => { setStatusFilter(e.target.value); setPage(0); }}
              displayEmpty
              startAdornment={<Filter className="w-4 h-4 mr-2 text-gray-400" />}
            >
              <MenuItem value="">Tất cả trạng thái</MenuItem>
              <MenuItem value="answered">Đã trả lời</MenuItem>
              <MenuItem value="not_found">Không tìm thấy</MenuItem>
              <MenuItem value="auto_generated">Tự sinh</MenuItem>
              <MenuItem value="out_of_topic">Lạc đề</MenuItem>
            </GreenSelect>
          </FormControl>
        </Box>

        {/* Active Heatmap Slot Filter Badge */}
        {slotFilter && (
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2.5} p={1.2} px={2} bgcolor="#f3f4f6" border="1px solid rgba(0, 0, 0, 0.12)" borderRadius="12px">
            <Typography variant="body2" fontWeight={600} sx={{ color: '#1f2937' }}>
              🎯 Đang lọc theo khung giờ Heatmap: <strong>{slotFilter.day} ({slotFilter.hour}:00 - {slotFilter.hour + 1}:00)</strong> — {filteredLogs.length} hội thoại
            </Typography>
            <Button
              size="small"
              startIcon={<X className="w-3.5 h-3.5" />}
              onClick={() => setSlotFilter(null)}
              sx={{ fontSize: '0.725rem', fontWeight: 500, color: '#ef4444', textTransform: 'none', py: 0.2 }}
            >
              Bỏ lọc khung giờ
            </Button>
          </Box>
        )}

        {/* Loading / Table view */}
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={8}>
            <CircularProgress size={36} sx={{ color: '#1f2937' }} />
            <Typography variant="body2" sx={{ mt: 2, color: "text.secondary", fontWeight: 600 }}>
              Đang tải dữ liệu hội thoại...
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer 
              component={Paper} 
              elevation={0} 
              sx={{ 
                borderRadius: '12px',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                maxHeight: 520,
                overflow: 'auto',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.8) inset'
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
                        <span className="font-semibold text-[#1f2937] text-sm">
                          {row.id}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        <Tooltip title={row.question} arrow placement="top">
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 500,
                              color: '#1f2937',
                              cursor: 'pointer',
                              '&:hover': { color: '#1f2937' }
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
                              color: '#6b7280',
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
                            sx={{ cursor: 'pointer', color: '#374151' }}
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
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            {row.created_at}
                          </Typography>
                        </Box>
                      </TableCell>
                    </StyledTableRow>
                  ))}
                  
                  {paginatedLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
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
                borderTop: '1px solid #f3f4f6',
                '& .MuiTablePagination-toolbar': {
                  px: 2,
                },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  fontSize: '0.8rem',
                  color: '#6b7280',
                  fontWeight: 600,
                },
              }}
            />
          </>
        )}
      </Box>
    </Box>
  );
}
