import { useState, createContext, useCallback, useMemo } from 'react'; // ==============================================================

// ==============================================================
export const LayoutContext = createContext({});
export default function LayoutProvider({ children }) {
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [showMobileSideBar, setShowMobileSideBar] = useState(false); // HANDLE SIDE BAR TOGGLE FOR LARGE DEVICE

  const handleSidebarCompactToggle = useCallback(() => {
    setSidebarCompact(state => !state);
  }, []); // HANDLE SIDE BAR OPEN FOR SMALL DEVICE

  const handleOpenMobileSidebar = useCallback(() => {
    setShowMobileSideBar(true);
  }, []); // HANDLE SIDE BAR CLOSE FOR SMALL DEVICE

  const handleCloseMobileSidebar = useCallback(() => {
    setShowMobileSideBar(false);
  }, []);
  const contextValue = useMemo(() => ({
    sidebarCompact,
    showMobileSideBar,
    handleOpenMobileSidebar,
    handleCloseMobileSidebar,
    handleSidebarCompactToggle
  }), [sidebarCompact, showMobileSideBar, handleOpenMobileSidebar, handleCloseMobileSidebar, handleSidebarCompactToggle]);
  
  return <LayoutContext.Provider value={contextValue}>{children}</LayoutContext.Provider>;
}