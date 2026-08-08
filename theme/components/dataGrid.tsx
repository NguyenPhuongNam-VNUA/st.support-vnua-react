export const DataGrid = theme => {
  return {
    defaultProps: {
      slotProps: {
        baseTextField: {
          variant: 'outlined',
          size: 'small'
        },
        baseSelect: {
          variant: 'outlined',
          size: 'small'
        }
      }
    },
    styleOverrides: {
      root: {
        border: 0
      },
      columnHeaders: {
        borderBottom: 0
      },
      iconSeparator: {
        color: theme.palette.grey[400]
      },
      cell: {
        borderBottom: 0,
        ':focus': {
          outline: 0
        }
      },
      columnHeader: {
        ':focus': {
          outline: 0
        },
        ':focus-within': {
          outline: 'none'
        }
      },
      footerContainer: {
        borderTop: 0
      },
      menu: {
        '.MuiList-root': {
          minWidth: 100
        },
        '.MuiPaper-root': {
          borderRadius: 8,
          boxShadow: theme.shadows[3]
        },
        '& .MuiMenuItem-root': {
          '.MuiTypography-root': {
            fontSize: 14
          }
        }
      },
      panel: {
        '.MuiPaper-root': {
          borderRadius: 8,
          boxShadow: theme.shadows[3]
        }
      },
      panelWrapper: {
        padding: 8,
        borderRadius: 8,
        '.MuiTextField-root': {
          '.MuiInput-root': {
            fontSize: 14
          }
        }
      },
      filterForm: {
        gap: 8
      },
      toolbarContainer: {
        paddingBottom: 12
      },
      filterFormDeleteIcon: {
        justifyContent: 'center'
      }
    }
  };
};