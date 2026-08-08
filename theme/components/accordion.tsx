export const Accordion = theme => {
  return {
    defaultProps: {
      elevation: 0,
      disableGutters: true
    },
    styleOverrides: {
      root: {
        overflow: 'hidden',
        marginBottom: '1rem',
        border: `1px solid ${theme.palette.grey[100]}`,
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        ':before': {
          display: 'none'
        },
        ':last-of-type': {
          marginBottom: 0
        },
        ...theme.applyStyles('dark', {
          border: `1px solid ${theme.palette.grey[700]}`
        })
      },
      rounded: {
        borderRadius: '1rem !important'
      }
    },
    variants: [{
      props: {
        variant: 'outlined'
      },
      style: {
        borderLeftWidth: 3,
        '.MuiAccordionDetails-root': {
          paddingTop: '1rem'
        },
        '&.Mui-expanded': {
          borderColor: theme.palette.primary.main,
          '.MuiAccordionSummary-root': {
            color: theme.palette.primary.main,
            backgroundColor: theme.palette.grey[50],
            ...theme.applyStyles('dark', {
              backgroundColor: theme.palette.grey[900]
            })
          },
          '.MuiAccordionSummary-expandIconWrapper': {
            color: theme.palette.primary.main
          }
        }
      }
    }]
  };
};
export const AccordionDetails = theme => ({
  styleOverrides: {
    root: {
      fontSize: 14,
      paddingTop: 4,
      fontWeight: 400,
      paddingInline: 24,
      paddingBottom: 24,
      color: theme.palette.grey[400]
    }
  }
});
export const AccordionSummery = theme => ({
  styleOverrides: {
    root: {
      fontSize: 14,
      fontWeight: 600,
      padding: '0 1.5rem',
      color: theme.palette.grey[400],
      transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
      '&.Mui-expanded': {
        color: theme.palette.grey[700],
        ...theme.applyStyles('dark', {
          color: theme.palette.grey[100]
        })
      }
    },
    content: {
      alignItems: 'center'
    },
    expandIconWrapper: {
      color: theme.palette.grey[400]
    }
  }
});