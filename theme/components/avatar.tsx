// ==============================================================
// ==============================================================
export const Avatar = theme => {
  return {
    variants: [{
      props: {
        variant: 'bordered'
      },
      style: {
        padding: 3,
        backgroundOrigin: 'border-box',
        border: 'double 1px transparent',
        backgroundClip: 'padding-box, border-box',
        backgroundImage: `linear-gradient(white, white), conic-gradient(from 30deg, ${theme.palette.primary.main} 180deg, ${theme.palette.grey[200]} 180deg)`,
        ...theme.applyStyles('dark', {
          backgroundImage: `linear-gradient(${theme.palette.grey[800]}, ${theme.palette.grey[800]}), conic-gradient(from 30deg, ${theme.palette.primary.main} 180deg, ${theme.palette.grey[800]} 180deg)`
        })
      }
    }]
  };
};
export const AvatarGroup = theme => {
  return {
    styleOverrides: {
      avatar: {
        width: 36,
        height: 36,
        padding: 0,
        fontSize: 12,
        border: '2px solid white',
        ...theme.applyStyles('dark', {
          border: `1px solid ${theme.palette.grey[600]}`
        })
      },
      root: {
        justifyContent: 'flex-end'
      }
    }
  };
};