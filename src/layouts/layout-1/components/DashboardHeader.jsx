import Box from '@mui/material/Box';

import { DashboardHeaderRoot, StyledToolBar } from '@/layouts/layout-1/styles';
import { Avatar } from '@mui/material';
export default function DashboardHeader() {

  return <DashboardHeaderRoot position="sticky">
      <StyledToolBar>

        <Box flexGrow={1} ml={1} />

        {/* <div>Thông báo</div> */}
           
        <Avatar>A</Avatar> 
      </StyledToolBar>
    </DashboardHeaderRoot>;
}