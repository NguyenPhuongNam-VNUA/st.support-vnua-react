export const StepIcon = theme => ({
  styleOverrides: {
    root: {
      color: theme.palette.grey[400]
    }
  }
});
export const StepConnector = theme => ({
  styleOverrides: {
    line: {
      borderColor: theme.palette.grey[300],
      ...theme.applyStyles('dark', {
        borderColor: theme.palette.grey[700]
      })
    }
  }
});