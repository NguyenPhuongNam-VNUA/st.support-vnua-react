import Box from '@mui/material/Box';
import { Text } from './styles';

export default function ChatMsg({ message }: { message: string }) {
  return (
    <Box maxWidth={{ md: '100%', sm: '70%', xs: '80%' }}>
      <Text> {message}</Text>
    </Box>
  );
}
