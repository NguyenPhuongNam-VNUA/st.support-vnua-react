import { styled } from '@mui/material/styles';
import Divider from '@mui/material/Divider';
import ButtonBase from '@mui/material/ButtonBase';
export const StyledDivider = styled(Divider)(({
  theme
}) => ({
  fontSize: 13,
  marginBlock: '2rem',
  color: theme.palette.text.secondary
}));
export const SocialButton = styled(ButtonBase)(({
  theme
}) => ({
  padding: 12,
  borderRadius: 8,
  border: `1px solid ${theme.palette.divider}`,
  '.icon': {
    fontSize: 18,
  }
}));