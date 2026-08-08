import { alpha } from '@mui/material/styles';
export const Button = theme => {
  return {
    defaultProps: {
      color: 'primary',
      variant: 'contained'
    },
    styleOverrides: {
      root: {
        fontWeight: 500,
        borderRadius: 10,
        color: 'inherit',
        boxShadow: 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textTransform: 'none',
        textOverflow: 'ellipsis',
        '&.Mui-disabled': {
          color: theme.palette.grey[400]
        }
      },
      // contained variants
      contained: {
        color: 'white',
        ':hover': {
          boxShadow: 'none'
        },
        '&.Mui-disabled': {
          backgroundColor: theme.palette.grey[200],
          ...theme.applyStyles('dark', {
            backgroundColor: theme.palette.grey[600]
          })
        }
      },
      containedError: {
        ':hover': {
          backgroundColor: theme.palette.error[600]
        }
      },
      containedPrimary: {
        ':hover': {
          backgroundColor: theme.palette.primary[600]
        }
      },
      containedSuccess: {
        ':hover': {
          backgroundColor: theme.palette.success[700]
        }
      },
      containedWarning: {
        ':hover': {
          backgroundColor: theme.palette.warning[500]
        }
      },
      containedSecondary: {
        transition: 'none',
        color: theme.palette.text.primary,
        ':hover': {
          backgroundColor: theme.palette.grey[200]
        },
        ...theme.applyStyles('dark', {
          backgroundColor: theme.palette.grey[700],
          ':hover': {
            backgroundColor: theme.palette.grey[600]
          }
        })
      },
      containedInherit: {
        backgroundColor: theme.palette.text.primary,
        ':hover': {
          backgroundColor: alpha(theme.palette.text.primary, 0.9)
        },
        ...theme.applyStyles('dark', {
          color: 'black'
        })
      },
      // outlined variants
      outlinedError: {
        color: theme.palette.error.main
      },
      outlinedPrimary: {
        color: theme.palette.primary.main
      },
      outlinedSuccess: {
        color: theme.palette.success.main
      },
      outlinedWarning: {
        color: theme.palette.warning.main
      },
      outlinedSecondary: {
        transition: 'none',
        borderColor: theme.palette.grey[200],
        ...theme.applyStyles('dark', {
          borderColor: theme.palette.grey[700]
        })
      },
      // text variants
      textPrimary: {
        color: theme.palette.primary.main
      },
      textSecondary: {
        color: theme.palette.grey[600]
      },
      textSuccess: {
        color: theme.palette.success.main
      },
      textWarning: {
        color: theme.palette.warning.main
      },
      textError: {
        color: theme.palette.error.main
      },
      // sizes
      sizeSmall: {
        padding: '0.25rem .5rem',
        height: 30,
        lineHeight: 1.5
      },
      sizeMedium: {
        padding: '6px 14px'
      },
      sizeLarge: {
        padding: '8px 16px',
        height: 48
      }
    }
  };
};
export const ButtonBase = theme => {
  return {
    styleOverrides: {
      root: {
        fontFamily: theme.typography.fontFamily
      }
    }
  };
};
export const ButtonGroup = theme => {
  return {
    styleOverrides: {
      root: {
        boxShadow: 'none'
      },
      groupedContainedPrimary: {
        '&:not(:last-of-type)': {
          borderColor: theme.palette.primary[600]
        }
      },
      groupedContained: ({
        ownerState: {
          color
        }
      }) => ({ ...(color === 'success' && {
          '&:not(:last-of-type)': {
            borderColor: theme.palette.success[600]
          }
        }),
        ...(color === 'error' && {
          '&:not(:last-of-type)': {
            borderColor: theme.palette.error[400]
          }
        }),
        ...(color === 'warning' && {
          '&:not(:last-of-type)': {
            borderColor: theme.palette.warning[400]
          }
        })
      }),
      groupedContainedSecondary: {
        backgroundColor: theme.palette.secondary[200],
        '&:not(:last-of-type)': {
          borderColor: theme.palette.secondary[300]
        },
        ...theme.applyStyles('dark', {
          backgroundColor: theme.palette.secondary[700]
        }),
        ':hover': {
          backgroundColor: theme.palette.secondary[300],
          ...theme.applyStyles('dark', {
            backgroundColor: theme.palette.secondary[800]
          })
        }
      },
      groupedOutlinedSecondary: {
        ':hover': {
          borderColor: theme.palette.secondary[200],
          backgroundColor: theme.palette.secondary[200],
          ...theme.applyStyles('dark', {
            borderColor: theme.palette.secondary[700],
            backgroundColor: theme.palette.secondary[800]
          })
        }
      },
      groupedTextSecondary: {
        '&:not(:last-of-type)': {
          borderColor: theme.palette.secondary[300]
        }
      }
    }
  };
};
export const IconButton = theme => {
  return {
    styleOverrides: {
      colorSecondary: {
        color: theme.palette.grey[400],
        ':hover': {
          color: theme.palette.primary.main
        }
      }
    }
  };
};
export const LoadingButton = theme => {
  return {
    defaultProps: {
      variant: 'contained'
    },
    styleOverrides: {
      loadingIndicator: {
        color: theme.palette.grey[400]
      }
    }
  };
};