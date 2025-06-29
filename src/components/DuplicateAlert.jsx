import { useEffect } from "react";
import { Box, Alert, Tooltip } from "@mui/material";

function DuplicateAlert({ setError, question, score_str }) {
   
    useEffect(() => {
        const timer = setTimeout(() => setError(null), 10000);
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
                <Tooltip title={question}>
                    <span>
                        <u>Câu hỏi</u> đã tồn tại! ({score_str} trùng khớp)
                    </span>
                </Tooltip>
            </Alert>
        </Box>
    );
}

export default DuplicateAlert;
