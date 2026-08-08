import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell'; // CUSTOM COMPONENT

import FlexRowAlign from '@/components/flexbox/FlexRowAlign';
export default function TableDataNotFound() {
  return <TableRow>
      <TableCell colSpan={7}>
        <FlexRowAlign m={2} fontSize={18} minHeight={300} fontWeight={700} borderRadius={2} bgcolor="action.selected">
          Chưa có dữ liệu!
        </FlexRowAlign>
      </TableCell>
    </TableRow>;
}