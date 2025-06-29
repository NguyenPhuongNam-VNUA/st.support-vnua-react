import { checkboxClasses } from '@mui/material/Checkbox'; // CUSTOM ICON COMPONENTS

import CheckBoxIcon from '@/icons/CheckBoxIcon';
import BlankCheckBoxIcon from '@/icons/BlankCheckBoxIcon';
import CheckboxIndeterminateIcon from '@/icons/CheckboxIndeterminateIcon';
export const Checkbox = theme => ({
  defaultProps: {
    icon: <BlankCheckBoxIcon />,
    checkedIcon: <CheckBoxIcon />,
    indeterminateIcon: <CheckboxIndeterminateIcon />
  },
  styleOverrides: {
    colorSecondary: {
      [`&.${checkboxClasses.checked}`]: {
        color: theme.palette.grey[700]
      }
    }
  }
});