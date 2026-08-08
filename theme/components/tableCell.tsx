export const TableCell = theme => ({
  defaultProps: {
    padding: 'none'
  },
  styleOverrides: {
    root: {
      border: 'none',
      color: theme.palette.grey[500],
      ...theme.applyStyles('dark', {
        color: theme.palette.grey[200]
      })
    }
  }
});