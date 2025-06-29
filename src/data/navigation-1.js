// CUSTOM ICON COMPONENT
import duotone from '@/icons/duotone';
export const navigations = [
  {
    type: 'label',
    label: 'Dashboard'
  }, 
  {
    name: 'Analytics',
    icon: duotone.PersonChalkboard,
    path: '/admin',
  }, 
  {
    name: 'Trùng lặp dữ liệu',
    icon: '',
    path: '/test',
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
      } 
    ]
  },
  {
    name: 'Tài liệu quy chế, quy định,',
    icon: duotone.Folder,
    children: [
      {
        name: 'Danh sách tài liệu',
        path: '/admin/documents/'
      },
    ]
  }
//   {
//   name: 'Finance',
//   icon: '',
//   children: [{
//     name: 'Finance 1',
//     path: '/dashboard/finance'
//   }, {
//     name: 'Finance 2',
//     path: '/dashboard/finance-2'
//   }]
// }, {
//   name: 'CRM',
//   icon: '',
//   children: [{
//     name: 'CRM',
//     path: '/dashboard/crm'
//   }, {
//     name: 'CRM 2',
//     path: '/dashboard/crm-2'
//   }]
// }, {
//   name: 'Sales',
//   icon: '',
//   children: [{
//     name: 'Sales',
//     path: '/dashboard/sales'
//   }, {
//     name: 'Sales 2',
//     path: '/dashboard/sales-2'
//   }]
// }, {
//   name: 'Ecommerce',
//   path: '/dashboard/ecommerce',
//   icon: '',
// }, {
//   name: 'Logistics',
//   path: '/dashboard/logistics',
//   icon: '',
// }, {
//   name: 'Marketing',
//   path: '/dashboard/marketing',
//   icon: '',
// }, {
//   name: 'LMS',
//   path: '/dashboard/learning-management',
//   icon: '',
// }, {
//   name: 'Job Management',
//   path: '/dashboard/job-management',
//   icon: '',
// }, {
//   type: 'label',
//   label: 'Management'
// }, {
//   name: 'Profile',
//   icon: '',
//   path: '/dashboard/profile'
// }, {
//   name: 'Account',
//   icon: '',
//   path: '/dashboard/account'
// }, {
//   name: 'Users',
//   icon: '',
//   children: [{
//     name: 'Add User',
//     path: '/dashboard/add-user'
//   }, {
//     name: 'User List 1',
//     path: '/dashboard/user-list'
//   }, {
//     name: 'User Grid 1',
//     path: '/dashboard/user-grid'
//   }, {
//     name: 'User List 2',
//     path: '/dashboard/user-list-2'
//   }, {
//     name: 'User Grid 2',
//     path: '/dashboard/user-grid-2'
//   }]
// }, {
//   name: 'Products',
//   icon: '',
//   children: [{
//     name: 'Product List',
//     path: '/dashboard/product-list'
//   }, {
//     name: 'Product Grid',
//     path: '/dashboard/product-grid'
//   }, {
//     name: 'Create Product',
//     path: '/dashboard/create-product'
//   }, {
//     name: 'Product Details',
//     path: '/dashboard/product-details'
//   }]
// }, {
//   name: 'Invoice',
//   icon: '',
//   children: [{
//     name: 'Invoice List',
//     path: '/dashboard/invoice-list'
//   }, {
//     name: 'Invoice Details',
//     path: '/dashboard/invoice-details'
//   }, {
//     name: 'Create Invoice',
//     path: '/dashboard/create-invoice'
//   }]
// }, {
//   name: 'Ecommerce',
//   icon: '',
//   children: [{
//     name: 'Cart',
//     path: '/dashboard/cart'
//   }, {
//     name: 'Payment',
//     path: '/dashboard/payment'
//   }, {
//     name: 'Billing Address',
//     path: '/dashboard/billing-address'
//   }, {
//     name: 'Payment Complete',
//     path: '/dashboard/payment-complete'
//   }]
// }, {
//   name: 'Projects',
//   icon: '',
//   children: [{
//     name: 'Project 1',
//     path: '/dashboard/projects/version-1'
//   }, {
//     name: 'Project 2',
//     path: '/dashboard/projects/version-2'
//   }, {
//     name: 'Project 3',
//     path: '/dashboard/projects/version-3'
//   }, {
//     name: 'Project Details',
//     path: '/dashboard/projects/details'
//   }, {
//     name: 'Team Member',
//     path: '/dashboard/projects/team-member'
//   }]
// }, {
//   name: 'Data Table',
//   icon: '',
//   children: [{
//     name: 'Data Table 1',
//     path: '/dashboard/data-table-1'
//   }]
// }, {
//   type: 'label',
//   label: 'Apps'
// }, {
//   name: 'Todo List',
//   icon: '',
//   path: '/dashboard/todo-list'
// }, {
//   name: 'Chats',
//   icon: '',
//   path: '/dashboard/chat'
// }, {
//   name: 'Email',
//   icon: '',
//   children: [{
//     name: 'Inbox',
//     path: '/dashboard/mail/all'
//   }, {
//     name: 'Email Details',
//     path: '/dashboard/mail/details'
//   }, {
//     name: 'Create Email',
//     path: '/dashboard/mail/compose'
//   }]
// }, {
//   name: 'Pages',
//   icon: '',
//   children: [{
//     iconText: 'E',
//     name: 'Ecommerce',
//     path: '#ecommerce',
//     children: [{
//       name: 'Shop',
//       path: '/products'
//     }, {
//       name: 'Product Details',
//       path: '/products/Wu4GdphiI0F48eMQZ_zBJ'
//     }, {
//       name: 'Cart',
//       path: '/cart'
//     }, {
//       name: 'Checkout',
//       path: '/checkout'
//     }]
//   }, {
//     iconText: 'C',
//     name: 'Career',
//     path: '#career',
//     children: [{
//       name: 'Career (Admin)',
//       path: '/dashboard/career'
//     }, {
//       name: 'Career (Public)',
//       path: '/career'
//     }, {
//       name: 'Job Details',
//       path: '/career/designer'
//     }, {
//       name: 'Job Apply',
//       path: '/career/apply'
//     }]
//   }, {
//     name: 'About (Admin)',
//     path: '/dashboard/about'
//   }, {
//     name: 'About (Public)',
//     path: '/about-us'
//   }, {
//     name: 'Contact',
//     path: '/contact-us'
//   }, {
//     name: 'Faq',
//     path: '/faqs'
//   }, {
//     name: 'Pricing',
//     path: '/pricing'
//   }, {
//     name: 'Support',
//     path: '/dashboard/support'
//   }, {
//     name: 'Create Ticket',
//     path: '/dashboard/create-ticket'
//   }, {
//     name: 'File Manager',
//     path: '/dashboard/file-manager'
//   }]
// }, {
//   type: 'extLink',
//   name: 'Documentation',
//   icon: '',
//   path: 'https://uko-doc.vercel.app/'
// }, {
//   type: 'label',
//   label: 'Others'
// }, {
//   path: 'https://uko-doc.vercel.app/',
//   name: 'Item Disabled',
//   icon: '',
//   disabled: true
// }, {
//   name: 'Multi Level Item',
//   icon: '',
//   children: [{
//     name: 'Level A',
//     path: '#dashboard/cart'
//   }, {
//     iconText: 'B',
//     name: 'Level B',
//     path: '#dashboard/payment',
//     children: [{
//       name: 'Level B1',
//       path: '#dashboard/payment'
//     }, {
//       iconText: 'B',
//       name: 'Level B2',
//       path: '#dashboard/payment',
//       children: [{
//         name: 'Level B21',
//         path: '#dashboard/payment'
//       }, {
//         name: 'Level B22',
//         path: '#dashboard/payment'
//       }]
//     }]
//   }]
// }
];