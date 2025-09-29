import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes';
import { AuthProvider } from '@/state/authStore';
import '@/styles/globals.css';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from '@/auth/msal';
import { loadRuntimeConfig, getRuntimeConfig } from '@/lib/runtimeConfig';
import { setRuntimeApiBase } from '@/lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    mutations: { retry: 0 },
  },
});

async function bootstrap() {
  await loadRuntimeConfig();
  const cfg = getRuntimeConfig();
  setRuntimeApiBase(cfg?.apiBaseUrl);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </AuthProvider>
      </MsalProvider>
    </React.StrictMode>
  );
}

// Basic loading placeholder for very fast networks (micro flash avoidance is low priority)
bootstrap();
