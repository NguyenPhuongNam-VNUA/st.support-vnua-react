import { lazy, Suspense } from 'react';
import LinearProgress from '@mui/material/LinearProgress';

const AdminLayout = lazy(() => import('@/layouts/layout-1'));

// Pages: Dashboard
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard'));

// Pages: Questions
const QuestionListPage = lazy(() => import('@/pages/questions/question-list'));
const AddQuestionPage = lazy(() => import('@/pages/questions/add-question'));
const EditQuestionPage = lazy(() => import('@/pages/questions/edit-question'));
const ImportExcelPage = lazy(() => import('@/pages/questions/import-excel'));

// Pages: Documents
// const DocumentLibraryPage = lazy(() => import('@/pages/documents/documents'));

// Pages: ChatBot
const ChatBotPage = lazy(() => import('@/pages/chatBot/chat-bot'));

// Pages: Login
const LoginPage = lazy(() => import('@/pages/login/login'));

// Protected Route
const ProtectedRoute = lazy(() => import('@/components/ProtectedRoute'));

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
        path: 'login',
        element: (
          <Suspense fallback={<LinearProgress />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: 'admin',
        element: <ProtectedRoute />,
        children: [
          {
            element: (
              <Suspense fallback={<LinearProgress />}>
                <AdminLayout />
              </Suspense>
            ),
            children: [
              { 
                index: true, 
                element: (
                  <Suspense fallback={<LinearProgress />}>
                    <DashboardPage />
                  </Suspense>
                )
              },
              {
                path: 'questions',
                children: [
                  { 
                    index: true, 
                    element: (
                      <Suspense fallback={<LinearProgress />}>
                        <QuestionListPage /> 
                      </Suspense>
                    )
                  },
                  { 
                    path: 'add', 
                    element: (
                      <Suspense fallback={<LinearProgress />}>
                        <AddQuestionPage />
                      </Suspense>
                    )
                  },
                  { 
                    path: 'edit/:id', 
                    element: (
                      <Suspense fallback={<LinearProgress />}>
                        <EditQuestionPage />
                      </Suspense>
                    )
                  },
                  { path: 'import', element: <ImportExcelPage /> }
                ],
              },
              // { path: 'documents', element: <DocumentLibraryPage /> },
            ], 
          }, 
        ],
      },
    ],
  },
];

export default routes;
