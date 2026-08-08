import Box from '@mui/material/Box'; // ==============================================================

// ==============================================================
export default function FlexBetween({
  ref,
  children,
  ...props
}: any) {
  return <Box display="flex" alignItems="center" justifyContent="space-between" ref={ref} {...props}>
      {children}
    </Box>;
}