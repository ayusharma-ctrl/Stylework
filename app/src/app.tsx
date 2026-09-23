import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/api';
import { useSession } from './lib/store';
import { ErrorBoundary } from './components/error-boundary';
import Shell, { ThemeSync } from './components/shell';
import { Loading } from './components/feedback';
const Signin = lazy(() => import('./pages/signin')),
  Dashboard = lazy(() => import('./pages/dashboard')),
  Leads = lazy(() => import('./pages/leads')),
  LeadDetail = lazy(() => import('./pages/lead-detail')),
  Activity = lazy(() => import('./pages/activity')),
  Settings = lazy(() => import('./pages/settings'));
export function App() {
  const signedIn = useSession((state) => !!state.tokens);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeSync />
        <BrowserRouter>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Suspense fallback={<Loading />}>
            <Routes>
              {signedIn ? (
                <Route element={<Shell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="leads" element={<Leads />} />
                  <Route path="leads/:id" element={<LeadDetail />} />
                  <Route path="activity" element={<Activity />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              ) : (
                <Route path="*" element={<Signin />} />
              )}
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
