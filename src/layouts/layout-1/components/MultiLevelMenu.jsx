import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router'; // CUSTOM DEFINED HOOK

import useLayout from '@/layouts/layout-1/context/useLayout'; // CUSTOM COMPONENTS

import SidebarAccordion from './SidebarAccordion'; // CUSTOM STYLED COMPONENTS

import { ItemText, ListLabel, BulletIcon, ICON_STYLE, ExternalLink, NavItemButton } from '@/layouts/layout-1/styles'; // CUSTOM DATA

import { navigations } from '@/data/navigation-1'; // TYPES

// ===========================================================================
export default function MultiLevelMenu({
  sidebarCompact
}) {

  const navigate = useNavigate();
  const {
    pathname
  } = useLocation();
  const {
    handleCloseMobileSidebar
  } = useLayout(); // HANDLE ACTIVE CURRENT PAGE

  const activeRoute = useCallback(path => pathname === path, [pathname]); // HANDLE NAVIGATE TO ANOTHER PAGE

  const handleNavigation = useCallback(path => {
    navigate(path);
    handleCloseMobileSidebar?.();
  }, [navigate, handleCloseMobileSidebar]); // RENDER ICON FOR MENU ITEM

  const renderIcon = item => {
    if (item.icon) {
      return <item.icon sx={ICON_STYLE(activeRoute(item.path))} />;
    } else if (item.iconText) {
      return <span className="item-icon icon-text">{item.iconText}</span>;
    }

    return <BulletIcon active={activeRoute(item.path)} />;
  }; // RECURSIVE FUNCTION TO RENDER MULTI LEVEL MENU


  const renderLevels = data => {
    return data.map((item, index) => {
      // MENU LABEL DESIGN
      if (item.type === 'label') {
        return <ListLabel key={index} compact={sidebarCompact}>
            { item.label }
          </ListLabel>;
      } // MENU LIST WITH CHILDREN


      if (item.children) {
        return <SidebarAccordion key={index} item={item} sidebarCompact={sidebarCompact}>
            {renderLevels(item.children)}
          </SidebarAccordion>;
      } // MENU ITEM WITH EXTERNAL LINK


      if (item.type === 'extLink') {
        return <ExternalLink key={index} href={item.path} rel="noopener noreferrer" target="_blank">
            <NavItemButton key={item.name} name="child" active>
              {renderIcon(item)}
              <ItemText compact={sidebarCompact} active={activeRoute(item.path)}>
                {item.name}
              </ItemText>
            </NavItemButton>
          </ExternalLink>;
      }

      return <NavItemButton key={index} disabled={item.disabled} active={activeRoute(item.path)} onClick={() => handleNavigation(item.path)}>
          {renderIcon(item)}
          <ItemText compact={sidebarCompact} active={activeRoute(item.path)}>
            { item.name }
          </ItemText>
        </NavItemButton>;
    });
  };

  const filterNavigation = navigations;

  return <>{renderLevels(filterNavigation)}</>;
}