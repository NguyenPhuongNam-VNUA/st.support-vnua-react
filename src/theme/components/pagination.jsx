import { paginationItemClasses } from '@mui/material/PaginationItem';
export const TablePagination = theme => {
  return {
    styleOverrides: {
      select: {
        ':focus': {
          borderRadius: 8
        }
      },
      actions: {
        color: theme.palette.grey[600]
      },
      menuItem: {
        marginInline: 8,
        borderRadius: 8,
        justifyContent: 'center'
      }
    }
  };
};
export const Pagination = () => ({
  defaultProps: {
    color: 'primary',
    size: 'medium'
  }
});
export const PaginationItem = theme => {
  return {
    styleOverrides: {
      ellipsis: {
        border: 0
      },
      rounded: {
        borderRadius: 8
      },
      icon: ({
        ownerState: {
          color
        }
      }) => ({ ...(color === 'primary' && {
          color: theme.palette.primary.main
        }),
        ...(color === 'secondary' && {
          color: theme.palette.grey[700]
        }),
        ...(color === 'standard' && {
          color: theme.palette.grey[600]
        })
      }),
      text: ({
        ownerState: {
          color
        }
      }) => ({
        color: theme.palette.grey[400],
        border: `1px solid ${theme.palette.grey[200]}`,
        ...theme.applyStyles('dark', {
          border: `1px solid ${theme.palette.grey[700]}`
        }),
        [`&.${paginationItemClasses.selected}`]: {
          border: 0,
          ...(color === 'standard' && {
            color: theme.palette.grey[500],
            backgroundColor: theme.palette.grey[200],
            ':hover': {
              backgroundColor: theme.palette.grey[200]
            }
          })
        }
      }),
      textSecondary: {
        [`&.${paginationItemClasses.selected}`]: {
          color: 'white',
          backgroundColor: theme.palette.grey[700],
          ':hover': {
            backgroundColor: theme.palette.grey[700]
          }
        }
      },
      outlined: ({
        ownerState: {
          color
        }
      }) => ({
        color: theme.palette.grey[400],
        border: `1px solid ${theme.palette.grey[200]}`,
        ...theme.applyStyles('dark', {
          border: `1px solid ${theme.palette.grey[700]}`
        }),
        ...(color === 'standard' && {
          [`&.${paginationItemClasses.selected}`]: {
            color: theme.palette.grey[700],
            borderColor: theme.palette.grey[200],
            backgroundColor: theme.palette.grey[100],
            ':hover': {
              backgroundColor: theme.palette.grey[100]
            }
          }
        })
      }),
      outlinedSecondary: {
        [`&.${paginationItemClasses.selected}`]: {
          color: theme.palette.grey[700],
          borderColor: theme.palette.grey[300],
          backgroundColor: theme.palette.grey[200],
          ':hover': {
            backgroundColor: theme.palette.grey[300]
          }
        }
      }
    }
  };
};