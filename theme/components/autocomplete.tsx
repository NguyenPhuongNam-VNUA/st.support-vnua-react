import ExpandMore from '@mui/icons-material/ExpandMore';
export const Autocomplete = _theme => {
  return {
    defaultProps: {
      popupIcon: <ExpandMore />,
      slotProps: {
        paper: {
          sx: {
            marginTop: 1,
            borderRadius: 2
          }
        }
      }
    },
    styleOverrides: {
      option: {
        padding: 10,
        fontSize: 14,
        borderRadius: 8,
        marginInline: 10
      },
      tag: {
        maxWidth: 130
      }
    }
  };
};