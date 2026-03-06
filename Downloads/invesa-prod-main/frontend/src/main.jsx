import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
import '@neondatabase/neon-js/ui/css';
import './styles/index.css';
import App from './app/App.jsx';
import { authClient } from './shared/lib/authClient.js';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NeonAuthUIProvider authClient={authClient}>
        <App />
      </NeonAuthUIProvider>
    </QueryClientProvider>
  </StrictMode>,
);
