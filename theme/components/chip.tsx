export const Chip = theme => {
  return {
    defaultProps: {
      color: 'primary'
    },
    styleOverrides: {
      root: {
        lineHeight: 1,
        fontWeight: 500,
        borderRadius: 16
      },
      sizeSmall: {
        fontSize: 13
      },
      filled: ({
        ownerState: {
          color
        }
      }) => ({
        color: theme.palette.common.white,
        ...(color === 'default' && {
          backgroundColor: theme.palette.grey[500]
        })
      }),
      outlined: ({
        ownerState: {
          color
        }
      }) => ({ ...(color === 'default' && {
          color: theme.palette.grey[400]
        })
      }),
      filledSecondary: {
        color: theme.palette.grey[700],
        backgroundColor: theme.palette.grey[100],
        ...theme.applyStyles('dark', {
          color: theme.palette.grey[50],
          backgroundColor: theme.palette.grey[700]
        })
      },
      outlinedSecondary: {
        color: theme.palette.grey[700],
        borderColor: theme.palette.grey[700]
      },
      avatar: {
        ':has(img[src])': {
          backgroundColor: 'transparent'
        }
      },
      deleteIcon: ({
        ownerState: {
          variant,
          color,
          size
        }
      }) => ({
        opacity: 0.8,
        fontSize: 18,
        ':hover': {
          opacity: 1,
          color: 'inherit'
        },
        ...(variant === 'outlined' && {
          color: 'inherit'
        }),
        ...(variant === 'filled' && {
          color: color === 'secondary' ? 'inherit' : 'white'
        }),
        ...(size === 'small' && {
          fontSize: 16
        })
      }),
      clickable: ({
        ownerState: {
          color
        }
      }) => ({ ...(color === 'default' && {
          ':hover': {
            backgroundColor: theme.palette.grey[700]
          }
        })
      })
    }
  };
};