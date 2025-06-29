export const Breadcrumbs = theme => {
  return {
    styleOverrides: {
      separator: {
        color: theme.palette.grey[400],
        ...theme.applyStyles('dark', {
          color: theme.palette.grey[100]
        }),
        ':has(.dot)': {
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: theme.palette.grey[300],
          ...theme.applyStyles('dark', {
            backgroundColor: theme.palette.grey[100]
          })
        }
      },
      li: {
        fontSize: 14,
        fontWeight: 500,
        color: theme.palette.grey[700],
        ...theme.applyStyles('dark', {
          color: theme.palette.grey[100]
        })
      },
      root: {
        padding: '1rem',
        borderRadius: 10,
        border: `1px solid ${theme.palette.grey[100]}`,
        ...theme.applyStyles('dark', {
          border: `1px solid ${theme.palette.grey[700]}`
        })
      }
    }
  };
};