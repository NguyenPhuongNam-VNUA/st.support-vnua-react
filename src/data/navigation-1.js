// CUSTOM ICON COMPONENT
import duotone from '@/icons/duotone';
export const navigations = [
  {
    type: 'label',
    label: 'Dashboard'
  }, 
  {
    name: 'Trang điều khiển',
    icon: duotone.PersonChalkboard,
    path: '/admin',
  }, 
  {
    type: 'label',
    label: 'Dữ liệu'
  }, 
  {
    name: 'Câu hỏi thường gặp',
    icon: duotone.FileCircleQuestion,
    children: [
      {
        name: 'Danh sách câu hỏi',
        path: '/admin/questions/'
      }, 
      {
        name: 'Thêm mới dữ liệu',
        path: '/admin/questions/add'
      },
      {
        name: 'Import dữ liệu',
        path: '/admin/questions/import'
      }
    ]
  },
  {
    name: 'Tài liệu quy chế, quy định',
    icon: duotone.Folder,
    children: [
      {
        name: 'Danh sách tài liệu',
        path: '/admin/documents/'
      },
    ]
  }
];