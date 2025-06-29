export const Switch = theme => {
  return {
    styleOverrides: {
      track: {
        borderRadius: 16,
        backgroundColor: theme.palette.grey[500]
      },
      switchBase: ({
        ownerState
      }) => ({
        padding: ownerState.size === 'small' ? '6px !important' : 11
      }),
      root: ({
        ownerState
      }) => ({
        padding: ownerState.size === 'small' ? 3 : 8
      }),
      thumb: ({
        ownerState
      }) => ({
        width: 16,
        height: 16,
        ...(ownerState.size === 'small' && {
          width: '12px !important',
          height: '12px !important'
        })
      })
    }
  };
};