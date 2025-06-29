import { useEffect } from 'react';
import { Box, Alert } from "@mui/material";

function SuccessAlert({ setOpen, message }) {

     useEffect(() => {
            const timer = setTimeout(() => setOpen(null), 10000);
            return () => clearTimeout(timer); // Dọn dẹp khi component bị unmount
        }, [setOpen]);

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 1300,
                minWidth: 300
            }}
        >
            <Alert severity="success" onClose={() => setOpen(false)} variant="filled">
                {message || "success!"}
            </Alert>
        </Box>
    );
}

export default SuccessAlert;