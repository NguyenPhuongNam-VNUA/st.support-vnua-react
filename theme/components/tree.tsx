import { treeItemClasses } from '@mui/x-tree-view/TreeItem';
export const TreeItem = () => ({
  styleOverrides: {
    root: {
      [`.${treeItemClasses.content}`]: {
        borderRadius: 4
      }
    }
  }
});