import { alpha } from '@mui/material/styles'; // MUI ICON COMPONENTS

import Info from '@mui/icons-material/Info';
import Error from '@mui/icons-material/Error';
import Warning from '@mui/icons-material/Warning';
import CheckCircle from '@mui/icons-material/CheckCircle';

const standardStyle = color => ({
  color: color.main,
  backgroundColor: color[50]
});

const outlinedStyle = color => ({
  color: color.main,
  borderColor: color.main,
  backgroundColor: color[50]
});

const actionBtnStyle = (primary, secondary) => ({
  '& .btn-group button': {
    ':first-of-type': {
      border: `1px solid ${secondary}`,
      marginRight: '1rem'
    },
    ':last-of-type': {
      color: primary,
      backgroundColor: secondary
    }
  }
});

export const Alert = theme => {
  const {
    primary,
    success,
    error,
    warning,
    common,
    grey
  } = theme.palette;
  return {
    defaultProps: {
      iconMapping: {
        info: <Info />,
        error: <Error />,
        success: <CheckCircle />,
        warning: <Warning />
      }
    },
    styleOverrides: {
      root: {
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        alignItems: 'center'
      },
      standardError: { ...standardStyle(error),
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(theme.palette.error.main, 0.1)
        })
      },
      standardSuccess: { ...standardStyle(success),
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(theme.palette.success.main, 0.1)
        })
      },
      standardWarning: { ...standardStyle(warning),
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(theme.palette.warning.main, 0.1)
        })
      },
      standardInfo: { ...standardStyle(primary),
        '& .MuiAlert-icon': {
          color: primary.main
        },
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(theme.palette.primary.main, 0.1)
        })
      },
      outlinedError: { ...outlinedStyle(error),
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(theme.palette.error.main, 0.1)
        })
      },
      outlinedSuccess: { ...outlinedStyle(success),
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(theme.palette.success.main, 0.1)
        })
      },
      outlinedWarning: { ...outlinedStyle(warning),
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(theme.palette.warning.main, 0.1)
        })
      },
      outlinedInfo: { ...outlinedStyle(primary),
        '& .MuiAlert-icon': {
          color: primary.main
        },
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(theme.palette.primary.main, 0.1)
        })
      },
      filledWarning: {
        color: common.white
      },
      filledSuccess: {
        color: common.white,
        backgroundColor: success[600]
      },
      filledInfo: {
        color: common.white,
        backgroundColor: primary.main
      },
      action: ({
        ownerState: {
          severity,
          variant
        }
      }) => ({
        ':has( > .btn-group)': {
          padding: 0,
          '& button': {
            fontWeight: 600,
            borderRadius: 10,
            padding: '.5rem 1rem'
          }
        },
        ...(severity === 'info' && { ...(variant === 'filled' && actionBtnStyle(primary.main, common.white)),
          ...(variant === 'outlined' && actionBtnStyle(common.white, primary.main)),
          ...(variant === 'standard' && actionBtnStyle(common.white, primary.main))
        }),
        ...(severity === 'error' && { ...(variant === 'filled' && actionBtnStyle(error.main, common.white)),
          ...(variant === 'outlined' && actionBtnStyle(common.white, error.main)),
          ...(variant === 'standard' && actionBtnStyle(common.white, error.main))
        }),
        ...(severity === 'success' && { ...(variant === 'filled' && actionBtnStyle(success.main, common.white)),
          ...(variant === 'outlined' && actionBtnStyle(common.white, success.main)),
          ...(variant === 'standard' && actionBtnStyle(common.white, success.main))
        }),
        ...(severity === 'warning' && { ...(variant === 'filled' && actionBtnStyle(warning.main, common.white)),
          ...(variant === 'outlined' && actionBtnStyle(common.white, warning.main)),
          ...(variant === 'standard' && actionBtnStyle(common.white, warning.main))
        })
      })
    }
  };
};