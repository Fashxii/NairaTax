import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ContentProvider } from './context/ContentContext.tsx';
import { SessionProvider } from './context/SessionContext.tsx';
import { ToastProvider } from './components/Toast.tsx';
import { router } from './router.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <ContentProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ContentProvider>
    </SessionProvider>
  </StrictMode>,
);
