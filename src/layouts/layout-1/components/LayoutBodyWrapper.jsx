// MUI
import Container from '@mui/material/Container';
import { styled } from '@mui/material/styles'; // LAYOUT BASED HOOK

import useLayout from '@/layouts/layout-1/context/useLayout'; // STYLED COMPONENT

const RootStyled = styled('div', {
  shouldForwardProp: prop => prop !== 'compact'
})(({
  theme,
  compact
}) => ({
  marginLeft: compact ? 86 : 280,
  transition: 'margin-left 0.3s ease-in-out',
  backgroundColor: 'rgb(244, 244, 244)',
  [theme.breakpoints.down(1200)]: {
    marginLeft: 0,
  },
  minHeight: '100vh',
}));
export default function LayoutBodyWrapper({
  children
}) {
  const {
    sidebarCompact
  } = useLayout();
  return <RootStyled compact={sidebarCompact}>
      <Container maxWidth="lg">{children}</Container>
    </RootStyled>;
}