import Tooltip from '@mui/material/Tooltip';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography'; // CUSTOM ICON COMPONENT

import Delete from '@/icons/Delete'; // ==============================================================

// ==============================================================
export default function TableToolbar({
  selected,
  handleDeleteRows
}) {
  return <Toolbar sx={{
    backgroundColor: 'action.selected'
  }}>
      <Typography variant="body2" sx={{
      fontWeight: 500,
      flex: '1 1 100%'
    }}>
        {selected} selected
      </Typography>

      <Tooltip title="Delete">
        <IconButton onClick={handleDeleteRows} color="error">
          <Delete />
        </IconButton>
      </Tooltip>
    </Toolbar>;
}