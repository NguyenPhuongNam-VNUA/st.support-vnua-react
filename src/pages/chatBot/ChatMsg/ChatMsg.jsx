import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { Text } from './styles';

export default function ChatMsg({ message }) {
  return <Box maxWidth={{
    md: '60%',
    sm: '70%',
    xs: '80%'
  }}>
      <Typography
        variant="body2"
        sx={{
          whiteSpace: 'pre-wrap',
          backgroundColor: '#f0f0f0',
          borderRadius: 2,
          px: 2,
          py: 1,
          maxWidth: '80%',
        }}
      >
        {message}
      </Typography>
    </Box>;
}