import { tabClasses } from '@mui/material/Tab';
export const Tab = theme => ({
  defaultProps: {
    disableRipple: true
  },
  styleOverrides: {
    root: {
      padding: 0,
      minHeight: 40,
      fontWeight: 400,
      minWidth: 'auto',
      textTransform: 'none',
      [`&.${tabClasses.selected}`]: {
        fontWeight: 600
      }
    },
    labelIcon: ({
      ownerState: {
        iconPosition
      }
    }) => ({// ...((iconPosition === 'top' || iconPosition === 'bottom') && { marginBottom: 8 }),
    }),
    textColorSecondary: {
      [`&.${tabClasses.selected}`]: {
        color: theme.palette.text.primary
      }
    },
    iconWrapper: {
      // marginBottom: 0,
      fontSize: '1.2rem'
    }
  }
});
export const Tabs = theme => ({
  styleOverrides: {
    flexContainer: {
      gap: '2rem'
    },
    scrollButtons: {
      [`&.${tabClasses.disabled}`]: {
        opacity: 0.2
      }
    },
    root: {
      minHeight: 45,
      borderBottom: `1px solid ${theme.palette.grey[100]}`,
      ...theme.applyStyles('dark', {
        borderBottom: `1px solid ${theme.palette.grey[700]}`
      })
    },
    indicator: ({
      ownerState
    }) => ({ ...(ownerState?.indicatorColor === 'secondary' && {
        backgroundColor: theme.palette.text.primary
      })
    })
  }
});
export const TabList = () => ({
  styleOverrides: {
    flexContainer: {
      gap: 0
    }
  }
});
export const TabPanel = () => ({
  styleOverrides: {
    root: {
      padding: 0
    }
  }
});