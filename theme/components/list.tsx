export const ListItemText = () => ({
  styleOverrides: {
    root: {
      margin: 0
    },
    multiline: {
      margin: 0
    }
  }
});
export const ListItemIcon = theme => ({
  styleOverrides: {
    root: {
      marginRight: 12,
      minWidth: 'auto !important',
      color: theme.palette.grey[600]
    }
  }
});