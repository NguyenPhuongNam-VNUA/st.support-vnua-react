import Box from '@mui/material/Box';
import { Avatar, Typography, Button } from '@mui/material';
import { DashboardHeaderRoot, StyledToolBar } from '@/layouts/layout-1/styles';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardHeader() {
  const { user, setToken, setUser } = useAuth();

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <DashboardHeaderRoot position="sticky">
      <StyledToolBar>

        <Box flexGrow={1} ml={1}>
          <Typography variant="h6" color="textPrimary">
            Hệ thống hỗ trợ sinh viên
          </Typography>
        </Box>

        {user && (
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body1">{user.name}</Typography>
            <Avatar>{user.name?.charAt(0)?.toUpperCase() || 'A'}</Avatar>
            <Button color="inherit" onClick={handleLogout}>
              Đăng xuất
            </Button>
          </Box>
        )}
      </StyledToolBar>
    </DashboardHeaderRoot>
  );
}
