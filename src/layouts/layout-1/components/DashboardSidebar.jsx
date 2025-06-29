import { memo, useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton'; // LAYOUT BASED HOOK

import useLayout from '@/layouts/layout-1/context/useLayout'; // CUSTOM COMPONENTS

import MultiLevelMenu from './MultiLevelMenu';
import Link from '@/components/link';
import Scrollbar from '@/components/scrollbar';
import FlexBetween from '@/components/flexbox/FlexBetween';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { SidebarWrapper } from '../styles';

//CONSTANTS
const TOP_HEADER_AREA = 70;
const LOGO_PATH = '/logo-vnua.png';

export default function DashboardSidebar() {
  const {
    sidebarCompact,
    handleSidebarCompactToggle
  } = useLayout(); // useContext(LayoutContext);

  const [onHover, setOnHover] = useState(false); // ACTIVATE COMPACT WHEN TOGGLE BUTTON CLICKED AND NOT ON HOVER STATE

  const isCompact = useMemo(() => sidebarCompact && !onHover, [sidebarCompact, onHover]);
  const handleMouseEnter = useCallback(() => {
    setOnHover(true);
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (sidebarCompact) setOnHover(false);
  }, [sidebarCompact]);
  
  return (
    <SidebarWrapper compact={sidebarCompact} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <SidebarHeader isCompact={isCompact} onToggle={handleSidebarCompactToggle} />
      <SidebarContent isCompact={isCompact} />
    </SidebarWrapper>
  );
}

const SidebarContent = memo(({
  isCompact
}) => <Scrollbar autoHide clickOnTrack={false} sx={{
  overflowX: 'hidden',
  maxHeight: `calc(100vh - ${TOP_HEADER_AREA}px)`
}}>
    <Box height="100%" px={2}>
      <MultiLevelMenu sidebarCompact={isCompact} />
    </Box>
  </Scrollbar>);

const SidebarHeader = memo(({
  isCompact,
  onToggle
}) => <FlexBetween padding="1.5rem 1rem .5rem 1.8rem" height={TOP_HEADER_AREA}>
    <Logo />
    {!isCompact && <CollapseButton onClick={onToggle} />}
  </FlexBetween>);

const CollapseButton = memo(({
  onClick
}) => <IconButton onClick={onClick}>
    <ArrowBackIcon />
  </IconButton>);
const Logo = memo(() => <Link href="/">
    <Box component="img" src={LOGO_PATH} alt="logo" width={30} />
  </Link>);