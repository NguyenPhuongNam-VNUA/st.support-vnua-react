import Box from '@mui/material/Box'; // ==============================================================

// ==============================================================
export default function FlexRowAlign({
  ref,
  children,
  ...props
}: any) {
  return <Box display="flex" alignItems="center" justifyContent="center" ref={ref} {...props}>
      {children}
    </Box>;
}