import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import Box from '@mui/material/Box';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography   
} from "@mui/material";
import { FileText } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFPreview = ({ fileUrl }: { fileUrl: string }) => {
    const [numPages, setNumPages] = useState<number | null>(null);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => setNumPages(numPages);

    return (
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
                {Array.from({ length: numPages || 0 }, (_, i) => (
                    <Page
                        key={i}
                        pageNumber={i + 1}
                        width={600}
                    />
                ))}
            </Document>
        </Box>
    );
};

export default function DialogPreview({ open, onClose, filePath }: any) {
    return(
        <Dialog 
          open={open} 
          onClose={onClose} 
          fullWidth 
          maxWidth="md"
          slotProps={{
            backdrop: {
              sx: {
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(8px)',
              }
            }
          }}
          PaperProps={{
            sx: {
              borderRadius: '12px',
              p: 1.5,
              backgroundColor: '#ffffff',
              boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.95) inset',
              border: '1px solid rgba(0, 0, 0, 0.12)',
            }
          }}
        >
            <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <FileText className="w-6 h-6 text-[#1f2937]" />
                <Typography variant="h6" fontWeight={600} sx={{ color: '#1f2937', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                  Xem trước tài liệu PDF
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ p: 2.5, pt: 1 }}>
                <PDFPreview fileUrl={filePath} />
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 2 }}>
                <Button 
                  onClick={ onClose }
                  sx={{
                    borderRadius: '8px',
                    px: 3.5,
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    color: '#4b5563',
                    bgcolor: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    '&:hover': { bgcolor: '#f3f4f6', color: '#1f2937' },
                  }}
                >
                  Đóng
                </Button>
            </DialogActions>
        </Dialog>
    );
}

