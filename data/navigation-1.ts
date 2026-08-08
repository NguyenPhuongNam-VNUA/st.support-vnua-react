import { LayoutDashboard, HelpCircle } from 'lucide-react';

export const navigations = [
  {
    type: 'label',
    label: 'Dashboard'
  }, 
  {
    name: 'Trang điều khiển',
    icon: LayoutDashboard,
    path: '/admin',
  }, 
  {
    type: 'label',
    label: 'Dữ liệu'
  }, 
  {
    name: 'Câu hỏi thường gặp',
    icon: HelpCircle,
    children: [
      {
        name: 'Danh sách câu hỏi',
        path: '/admin/questions'
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
  }
];