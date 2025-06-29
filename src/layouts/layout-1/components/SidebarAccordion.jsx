import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router'; // MUI

import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse'; // REACT TRANSLATION

import { ItemText, ICON_STYLE, BulletIcon, AccordionButton, ChevronRightStyled, AccordionExpandPanel } from '@/layouts/layout-1/styles'; // TYPES

// ==============================================================
export default function SidebarAccordion({
  item,
  children,
  sidebarCompact
}) {
  const { pathname } = useLocation();
  const [hasActive, setHasActive] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const handleClick = useCallback(() => setCollapsed(state => !state), []);
  const hasActiveChild = useMemo(() => {
    const checkActive = currentItem => {
      if (currentItem.path === pathname) return true;
      if (currentItem.children) return currentItem.children.some(checkActive);
      return false;
    };

    return checkActive(item);
  }, [item, pathname]);
  
  useEffect(() => {
    setHasActive(hasActiveChild);
    setCollapsed(hasActiveChild);
  }, [hasActiveChild]);
  return <Fragment>
      <AccordionButton onClick={handleClick} active={sidebarCompact && hasActive}>
        <Box pl="7px" display="flex" alignItems="center">
         
          {item.icon && <item.icon sx={ICON_STYLE(hasActive)} />}

          {item.iconText && <BulletIcon active={hasActive} />}

          <ItemText compact={sidebarCompact} active={hasActive}>
            {item.name}
          </ItemText>
        </Box>

        <ChevronRightStyled active={hasActive} collapsed={collapsed} compact={sidebarCompact} className="accordionArrow" />
      </AccordionButton>

      {!sidebarCompact && <Collapse in={collapsed} unmountOnExit mountOnEnter>
          <AccordionExpandPanel className="expand">{children}</AccordionExpandPanel>
        </Collapse>}
    </Fragment>;
}