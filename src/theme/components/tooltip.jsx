export const Tooltip = theme => ({
  styleOverrides: {
    tooltip: {
      borderRadius: 8,
      backgroundColor: theme.palette.text.primary,
      ...theme.applyStyles('dark', {
        backgroundColor: theme.palette.grey[700]
      })
    },
    arrow: {
      color: theme.palette.text.primary,
      ...theme.applyStyles('dark', {
        backgroundColor: theme.palette.grey[700]
      })
    }
  }
});