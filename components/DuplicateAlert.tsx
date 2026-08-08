import { useEffect } from "react";
import { Box, Alert, Tooltip, Typography } from "@mui/material";

function DuplicateAlert({ setError, question, score_str }) {
   
    useEffect(() => {
        const timer = setTimeout(() => setError(null), 15000);
        return () => clearTimeout(timer); // Dọn dẹp khi component bị unmount
    }, [setError]);

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 1300,
                minWidth: 300,
            }}
        >
            <Alert severity="error" onClose={() => setError(null)} variant="filled">
                <Tooltip 
                    placement="bottom-end"
                    // arrow
                    title={
                        <Box sx={{ p: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                                Câu hỏi đã tồn tại trong hệ thống
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                <strong>Câu hỏi:</strong> {question}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ mt: 0.5, color: "warning.light", fontWeight: "bold" }}
                            >
                                ({score_str} trùng khớp)
                            </Typography>
                            <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                                Vui lòng chỉnh sửa để tránh trùng lặp.
                            </Typography>
                        </Box>    
                    }
                >
                    <span>
                        <u>Câu hỏi</u> đã tồn tại! ({score_str} trùng khớp)
                    </span>
                </Tooltip>
            </Alert>
        </Box>
    );
}

export default DuplicateAlert;
