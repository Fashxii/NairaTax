import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ContentProvider } from './context/ContentContext.tsx';
import { SessionProvider } from './context/SessionContext.tsx';
import { router } from './router.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <ContentProvider>
        <RouterProvider router={router} />
      </ContentProvider>
    </SessionProvider>
  </StrictMode>,
);
