import { Fab } from './fab';
import { Chip } from './chip';
import { Alert } from './alert';
import { Radio } from './radio';
import { Badge } from './badge';
import { Rating } from './rating';
import { Switch } from './switch';
import { Backdrop } from './backdrop';
import { DataGrid } from './dataGrid';
import { Breadcrumbs } from './breadcrumbs';
import { Autocomplete } from './autocomplete';
import { AppBar } from './appbar';
import { Paper } from './paper';
import { Slider } from './slider';
import { TreeItem } from './tree';
import { Tooltip } from './tooltip';
import { SnackbarContent } from './snackbar';
import { StepConnector, StepIcon } from './step';
import { TimelineConnector, TimelineDot } from './timeline';
import { Card } from './card';
import { Link } from './link';
import { SvgIcon } from './svgIcon';
import { Popover } from './popover';
import { Checkbox } from './checkbox';
import { TableCell } from './tableCell';
import { LinearProgress } from './progress';
import { Menu, MenuItem } from './menu';
import { Avatar, AvatarGroup } from './avatar';
import { ListItemIcon, ListItemText } from './list';
import { Tab, TabList, TabPanel, Tabs } from './tabs';
import { FilledInput, Input, InputLabel, OutlinedInput } from './input';
import { Pagination, PaginationItem, TablePagination } from './pagination';
import { Accordion, AccordionDetails, AccordionSummery } from './accordion';
import { Dialog, DialogActions, DialogContent, DialogTitle } from './dialog';
import { Button, ButtonBase, ButtonGroup, IconButton, LoadingButton } from './button';
import { DatePicker, TimePicker, DateTimePicker, MobileDatePicker, StaticDatePicker, DesktopDatePicker, DesktopTimePicker, DesktopDateTimePicker } from './pickers';

const componentsOverride = theme => {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
          scrollBehavior: 'smooth'
        },
        html: {
          width: '100%',
          height: '100%',
          WebkitOverflowScrolling: 'touch',
          MozOsxFontSmoothing: 'grayscale'
        },
        body: {
          width: '100%',
          height: '100%'
        },
        a: {
          color: theme.palette.primary.main,
          textDecoration: 'none'
        },
        input: {
          '&[type=number]': {
            MozAppearance: 'textfield',
            '&::-webkit-outer-spin-button': {
              margin: 0,
              WebkitAppearance: 'none'
            },
            '&::-webkit-inner-spin-button': {
              margin: 0,
              WebkitAppearance: 'none'
            }
          }
        },
        '#root': {
          width: '100%',
          height: '100%',
          '& .apexcharts-xaxistooltip': {
            display: 'none'
          },
          '& .apexcharts-tooltip': {
            border: 'none',
            borderRadius: 8,
            boxShadow: theme.shadows[2]
          }
        },
        '#nprogress .bar': {
          zIndex: '9999 !important',
          backgroundColor: theme.palette.primary.main
        },
        '#nprogress .peg': {
          boxShadow: 'none'
        },
        // REUSABLE UTILS CLASSNAME
        '.h-full': {
          height: '100%'
        },
        '.p-3': {
          padding: theme.spacing(3)
        },
        '.pt-2': {
          paddingTop: theme.spacing(2)
        },
        '.pb-0': {
          paddingBottom: theme.spacing(0)
        },
        '.pb-4': {
          paddingBottom: theme.spacing(4)
        },
        '.py-3': {
          paddingBlock: theme.spacing(3)
        },
        '.py-10': {
          paddingBlock: theme.spacing(10)
        },
        '.py-12': {
          paddingBlock: theme.spacing(12)
        }
      }
    },
    MuiRadio: Radio(),
    MuiFab: Fab(theme),
    MuiChip: Chip(theme),
    MuiAlert: Alert(theme),
    MuiBadge: Badge(theme),
    MuiSwitch: Switch(theme),
    MuiRating: Rating(theme),
    MuiDataGrid: DataGrid(theme),
    MuiBackdrop: Backdrop(theme),
    MuiBreadcrumbs: Breadcrumbs(theme),
    MuiAutocomplete: Autocomplete(theme),
    // AVATAR
    MuiAvatar: Avatar(theme),
    MuiAvatarGroup: AvatarGroup(theme),
    // BUTTON
    MuiButton: Button(theme),
    MuiIconButton: IconButton(theme),
    MuiButtonBase: ButtonBase(theme),
    MuiButtonGroup: ButtonGroup(theme),
    MuiLoadingButton: LoadingButton(theme),
    // ACCORDION
    MuiAccordion: Accordion(theme),
    MuiAccordionSummary: AccordionSummery(theme),
    MuiAccordionDetails: AccordionDetails(theme),
    // PAGINATION
    MuiPagination: Pagination(),
    MuiPaginationItem: PaginationItem(theme),
    MuiTablePagination: TablePagination(theme),
    // DIALOG
    MuiDialog: Dialog(),
    MuiDialogTitle: DialogTitle(),
    MuiDialogContent: DialogContent(),
    MuiDialogActions: DialogActions(),
    // MENU
    MuiMenu: Menu(),
    MuiMenuItem: MenuItem(),
    // LIST
    MuiListItemText: ListItemText(),
    MuiListItemIcon: ListItemIcon(theme),
    // TAB & TABLIST
    MuiTab: Tab(theme),
    MuiTabs: Tabs(theme),
    MuiTabList: TabList(),
    MuiTabPanel: TabPanel(),
    // DATE PICKER
    MuiDatePicker: DatePicker(),
    MuiMobileDatePicker: MobileDatePicker(),
    MuiStaticDatePicker: StaticDatePicker(),
    MuiDesktopDatePicker: DesktopDatePicker(),
    // TIME PICKER
    MuiTimePicker: TimePicker(),
    MuiDateTimePicker: DateTimePicker(),
    MuiDesktopTimePicker: DesktopTimePicker(),
    MuiDesktopDateTimePicker: DesktopDateTimePicker(),
    // INPUT & LABEL
    MuiInput: Input(theme),
    MuiInputLabel: InputLabel(theme),
    MuiFilledInput: FilledInput(theme),
    MuiOutlinedInput: OutlinedInput(theme),
    MuiPaper: Paper(),
    MuiAppBar: AppBar(),
    MuiTreeItem: TreeItem(),
    MuiSlider: Slider(theme),
    MuiTooltip: Tooltip(theme),
    MuiTimelineDot: TimelineDot(theme),
    MuiTimelineConnector: TimelineConnector(theme),
    MuiStepIcon: StepIcon(theme),
    MuiStepConnector: StepConnector(theme),
    MuiSnackbarContent: SnackbarContent(theme),
    MuiPopover: Popover(theme),
    MuiCard: Card(),
    MuiLink: Link(),
    MuiSvgIcon: SvgIcon(),
    MuiCheckbox: Checkbox(theme),
    MuiTableCell: TableCell(theme),
    MuiLinearProgress: LinearProgress(theme),
    MuiTextField: {
      defaultProps: {
        size: 'small'
      }
    }
  };
};

export default componentsOverride;