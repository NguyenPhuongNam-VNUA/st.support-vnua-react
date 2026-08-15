'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import { History, UserCheck, Clock, CheckCircle2, Edit3, ShieldAlert } from 'lucide-react';
import questionApi from '@/api/admin/questionApi';

interface AuditItem {
  id: number;
  user: string;
  action: string;
  timestamp: string;
  changes: string;
  status: string;
}

interface QuestionAuditLogDialogProps {
  open: boolean;
  onClose: () => void;
  questionId?: number;
  questionText: string;
}

export default function QuestionAuditLogDialog({
  open,
  onClose,
  questionId,
  questionText,
}: QuestionAuditLogDialogProps) {
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);

  useEffect(() => {
    if (!open || !questionId) return;
    questionApi.getAudit(questionId).then((response: any) => {
      const rows = response?.data?.logs || [];
      setAuditLogs(
        rows.map((row: any) => ({
          id: row.id,
          user: row.changed_by ? `Tài khoản #${row.changed_by}` : 'Hệ thống',
          action: row.action === 'create' ? 'Tạo câu hỏi' : row.action === 'delete' ? 'Xóa câu hỏi' : 'Cập nhật câu hỏi',
          timestamp: new Date(row.created_at).toLocaleString('vi-VN'),
          changes: JSON.stringify(row.new_value || row.old_value || {}),
          status: row.new_value?.status || row.old_value?.status || 'pending',
        }))
      );
    }).catch(() => setAuditLogs([]));
  }, [open, questionId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 0,
          p: 1,
          border: '1px solid #cbd5e1',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <div className="w-9 h-9 rounded-none bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
            <History className="w-5 h-5" />
          </div>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb', fontSize: '1.1rem', lineHeight: 1.2 }}>
              Lịch sử chỉnh sửa & kiểm duyệt (Audit Log)
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Theo dõi vết thay đổi dữ liệu huấn luyện Agent
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2 }}>
        <Box mb={2} p={1.5} bgcolor="#f8fafc" border="1px solid #e2e8f0">
          <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
            CÂU HỎI ĐANG XEM LOG:
          </Typography>
          <Typography variant="body2" fontWeight={700} color="slate.900">
            {questionText || 'Điểm chuẩn ngành Công nghệ thông tin là bao nhiêu?'}
          </Typography>
        </Box>

        {/* Timeline representation */}
        <Box display="flex" flexDirection="column" gap={2}>
          {auditLogs.map((item, index) => (
            <Box key={item.id} display="flex" gap={2} position="relative">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-none bg-blue-50 border border-blue-200 text-[#2563eb] flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                {index < auditLogs.length - 1 && (
                  <div className="w-0.5 bg-slate-200 flex-1 my-1" />
                )}
              </div>

              <Box flex={1} p={1.5} border="1px solid #f1f5f9" bgcolor="#ffffff">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography variant="body2" fontWeight={800} color="slate.900">
                    {item.action}
                  </Typography>
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {item.timestamp}
                  </span>
                </Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={0.5}>
                  Thực hiện bởi: <span className="text-slate-800 font-bold">{item.user}</span>
                </Typography>
                <Typography variant="body2" color="slate.700" sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                  &quot;{item.changes}&quot;
                </Typography>
              </Box>
            </Box>
          ))}
          {auditLogs.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Chưa có lịch sử thay đổi cho câu hỏi này.
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} variant="contained" sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 700, backgroundColor: '#2563eb' }}>
          Đóng cửa sổ
        </Button>
      </DialogActions>
    </Dialog>
  );
}
