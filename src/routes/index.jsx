import { lazy, Suspense } from 'react';
import LinearProgress from '@mui/material/LinearProgress';

const AdminLayout = lazy(() => import('@/layouts/layout-1'));

// Pages: Questions
const QuestionListPage = lazy(() => import('@/pages/questions/question-list'));
const AddQuestionPage = lazy(() => import('@/pages/questions/add-question'));
const EditQuestionPage = lazy(() => import('@/pages/questions/edit-question'));

// Pages: Documents
const DocumentLibraryPage = lazy(() => import('@/pages/documents/documents'));

// Pages: Fake test
const FakeDuplicateDialog = lazy(() => import('@/pages/fake'));

// Pages: ChatBot
const ChatBotPage = lazy(() => import('@/pages/chatbot/chat-bot'));

const routes = [
  {
    path: '/',
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LinearProgress />}>
            <ChatBotPage />
          </Suspense>
        ),
      },
      {
        path: 'test',
        element: (
          <Suspense fallback={<LinearProgress />}>
            <FakeDuplicateDialog />
          </Suspense>
        ),
      },
      {
        path: 'admin',
        element: (
          <Suspense fallback={<LinearProgress />}>
            <AdminLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: <div>Dashboard</div>,
          },
          {
            path: 'questions',
            children: [
              {
                index: true,
                element: <QuestionListPage />
              },
              {
                path: 'add',
                element: <AddQuestionPage />        
              },
              {
                path: 'edit/:id',
                element: <EditQuestionPage />               
              },
            ],
          },
          {
            path: 'documents',
            element: <DocumentLibraryPage />
          },
        ],
      },
    ],
  },
];

export default routes;
