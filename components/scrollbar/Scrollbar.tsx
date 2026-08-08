// STYLED COMPONENT
import { StyledScrollBar } from './styles'; // ========================================================

// ========================================================
export default function Scrollbar({
  children,
  sx,
  ...props
}) {
  return <StyledScrollBar sx={sx} {...props}>
      {children}
    </StyledScrollBar>;
}