export const TimelineDot = theme => ({
  defaultProps: {
    variant: 'filled',
    color: 'grey'
  },
  styleOverrides: {
    filledGrey: {
      backgroundColor: theme.palette.grey[300],
      '& .MuiSvgIcon-root': {
        color: theme.palette.grey[600]
      },
      ...theme.applyStyles('dark', {
        backgroundColor: theme.palette.grey[100]
      })
    }
  }
});
export const TimelineConnector = theme => ({
  styleOverrides: {
    root: {
      backgroundColor: theme.palette.grey[100],
      ...theme.applyStyles('dark', {
        backgroundColor: theme.palette.grey[700]
      })
    }
  }
});