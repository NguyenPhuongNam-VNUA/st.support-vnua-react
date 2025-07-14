import Box from '@mui/material/Box';

import { Text } from './styles';

export default function UserMsg({ message }) {
  return <Box alignSelf="end" maxWidth={{
    md: '60%',
    sm: '70%',
    xs: '80%'
  }}>
      <Text> { message } </Text>
    </Box>;
}