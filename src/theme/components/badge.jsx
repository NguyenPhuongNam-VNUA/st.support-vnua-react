export const Badge = theme => {
  return {
    styleOverrides: {
      colorError: {
        color: theme.palette.common.white
      },
      colorSuccess: {
        color: theme.palette.common.white
      },
      colorWarning: {
        color: theme.palette.common.white
      },
      colorSecondary: {
        backgroundColor: theme.palette.grey[300]
      },
      dot: {
        minWidth: 10,
        height: 10,
        borderRadius: '50%'
      }
    }
  };
};