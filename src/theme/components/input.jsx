import { alpha } from '@mui/material/styles';
export const Input = theme => ({
  styleOverrides: {
    root: {
      ':before': {
        borderColor: theme.palette.grey[400]
      }
    }
  }
});
export const OutlinedInput = theme => ({
  styleOverrides: {
    input: {
      color: theme.palette.text.primary
    },
    adornedEnd: {
      color: theme.palette.grey[400]
    },
    adornedStart: {
      color: theme.palette.grey[400]
    },
    inputSizeSmall: {
      padding: '12px 14px'
    },
    sizeSmall: {
      fontSize: 14,
      fontWeight: 400
    },
    notchedOutline: {
      borderRadius: 8,
      borderColor: theme.palette.grey[200],
      ...theme.applyStyles('dark', {
        borderColor: theme.palette.grey[700]
      })
    }
  }
});
export const FilledInput = theme => ({
  defaultProps: {
    disableUnderline: true
  },
  styleOverrides: {
    root: ({
      ownerState: {
        color,
        error
      }
    }) => ({
      borderRadius: 8,
      border: '1px solid transparent',
      backgroundColor: error ? theme.palette.error[50] : theme.palette.grey[100],
      transition: `background-color 200ms cubic-bezier(0.0, 0, 0.2, 1) 0ms, box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms`,
      ':hover': {
        backgroundColor: error ? theme.palette.error[50] : theme.palette.grey[100]
      },
      '&.Mui-disabled': {
        backgroundColor: theme.palette.grey[200],
        ...theme.applyStyles('dark', {
          backgroundColor: theme.palette.grey[400]
        })
      },
      '&.Mui-focused': {
        backgroundColor: error ? theme.palette.error[50] : theme.palette.grey[100],
        ...(color === 'primary' && {
          border: `1px solid ${error ? theme.palette.error.main : theme.palette.primary.main}`,
          boxShadow: `${error ? theme.palette.error.main : theme.palette.primary.main} 0 0 0 1px`
        }),
        ...theme.applyStyles('dark', {
          backgroundColor: error ? alpha(theme.palette.error[900], 0.2) : theme.palette.grey[800]
        })
      },
      ...theme.applyStyles('dark', {
        backgroundColor: error ? alpha(theme.palette.error[900], 0.2) : theme.palette.grey[800],
        ':hover': {
          backgroundColor: error ? alpha(theme.palette.error[900], 0.2) : theme.palette.grey[800]
        }
      })
    }),
    sizeSmall: {
      fontSize: 14,
      fontWeight: 400
    }
  }
}); // ==============================================================
//  MUI INPUT LABEL
// ==============================================================

export const InputLabel = theme => ({
  styleOverrides: {
    sizeSmall: {
      fontSize: 14,
      lineHeight: 1.9
    },
    standard: {
      fontWeight: 500
    },
    filled: {
      fontWeight: 500,
      '&.Mui-focused': {
        fontWeight: 600
      },
      '&.Mui-disabled': {
        color: theme.palette.grey[300]
      }
    }
  }
});