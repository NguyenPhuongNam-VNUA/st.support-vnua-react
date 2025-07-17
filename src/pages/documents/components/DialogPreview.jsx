import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import Box from '@mui/material/Box';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { 
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button   
} from "@mui/material";

const PDFPreview = ({ fileUrl }) => {
    const [numPages, setNumPages] = useState(null);

    const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);

    return (
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
                {Array.from({ length: numPages }, (_, i) => (
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


export default function DialogPreview({ open, onClose, filePath }) {
   
    return(
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Xem trước tài liệu PDF</DialogTitle>
            <DialogContent>
                <PDFPreview fileUrl={filePath} />
            </DialogContent>
            <DialogActions>
                <Button onClick={ onClose }>Đóng</Button>
            </DialogActions>
        </Dialog>
    );
}