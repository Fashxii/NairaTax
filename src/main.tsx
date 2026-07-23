import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ContentProvider } from './context/ContentContext.tsx';
import { router } from './router.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContentProvider>
      <RouterProvider router={router} />
    </ContentProvider>
  </StrictMode>,
);
