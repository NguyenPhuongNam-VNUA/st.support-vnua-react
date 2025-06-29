import { styled, alpha } from '@mui/material/styles';
import SimpleBar from 'simplebar-react'; // STYLED COMPONENT

export const StyledScrollBar = styled(SimpleBar)(({
  theme
}) => ({
  maxHeight: '100%',
  '& .simplebar-scrollbar': {
    '&.simplebar-visible:before': {
      opacity: 1
    },
    '&:before': {
      backgroundColor: alpha(theme.palette.grey[300], 0.6),
      ...theme.applyStyles('dark', {
        backgroundColor: alpha(theme.palette.grey[700], 0.6)
      })
    }
  },
  '& .simplebar-track.simplebar-vertical': {
    width: 9
  },
  '& .simplebar-track.simplebar-horizontal .simplebar-scrollbar': {
    height: 6
  },
  '& .simplebar-mask': {
    zIndex: 'inherit'
  }
}));