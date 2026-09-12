'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { Download, FilePenLine } from 'lucide-react';
import documentApi from '@/api/admin/documentApi';

interface MarkdownEditorDialogProps {
  open: boolean;
  documentId: number | null;
  documentTitle: string;
  onClose: () => void;
  onSaved: (document: any) => void;
}

export default function MarkdownEditorDialog({
  open,
  documentId,
  documentTitle,
  onClose,
  onSaved,
}: MarkdownEditorDialogProps) {
  const [content, setContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !documentId) return;
    let active = true;
    setLoading(true);
    setError(null);
    documentApi
      .getMarkdown(documentId)
      .then((response: any) => {
        if (!active) return;
        const markdown = response?.data?.markdown_content || '';
        setContent(markdown);
        setInitialContent(markdown);
      })
      .catch((requestError: any) => {
        if (active) setError(requestError?.response?.data?.message || 'Không thể tải Markdown');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, documentId]);

  const handleSave = async () => {
    if (!documentId || !content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response: any = await documentApi.updateMarkdown(documentId, content);
      onSaved(response.data);
      onClose();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể cập nhật Markdown');
    } finally {
      setSaving(false);
    }
  };

  const changed = content.replace(/\r\n?/g, '\n').trimEnd() !== initialContent.replace(/\r\n?/g, '\n').trimEnd();

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1.5}>
          <FilePenLine className="w-5 h-5 text-[#0d8a4f]" />
          <Box>
            <Typography variant="h6" fontWeight={800}>Xem và chỉnh sửa Markdown</Typography>
            <Typography variant="caption" color="text.secondary">{documentTitle}</Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Khi cập nhật, tài liệu sẽ tạm ngừng truy xuất. Hệ thống chỉ embedding lại các chunk thay đổi,
          sau đó thay chunk cũ và tự kích hoạt lại tài liệu.
        </Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <Box minHeight={420} display="flex" alignItems="center" justifyContent="center">
            <CircularProgress size={30} />
          </Box>
        ) : (
          <TextField
            value={content}
            onChange={(event) => setContent(event.target.value)}
            fullWidth
            multiline
            minRows={22}
            maxRows={30}
            placeholder="Nội dung Markdown của tài liệu"
            disabled={saving}
            inputProps={{ spellCheck: false }}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.55 } }}
          />
        )}
        <Typography variant="caption" color="text.secondary">
          {content.length.toLocaleString('vi-VN')} ký tự
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {documentId && (
          <Button
            component="a"
            href={`/api/admin/documents/${documentId}/markdown`}
            startIcon={<Download className="w-4 h-4" />}
            disabled={saving}
          >
            Tải MD
          </Button>
        )}
        <Box flex={1} />
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || saving || !content.trim() || !changed}
          sx={{ bgcolor: '#0d8a4f', '&:hover': { bgcolor: '#0a7543' } }}
        >
          {saving ? 'Đang cập nhật...' : 'Cập nhật & embedding lại'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
