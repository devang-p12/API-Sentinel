import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ApiProvider } from './context/ApiContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ApiDetails } from './components/ApiDetails';

// Monitoring
import { DashboardPage } from './pages/monitoring/DashboardPage';
import ApisPage from './pages/monitoring/ApisPage';
import { ApiDetailPage } from './pages/monitoring/ApiDetailPage';

// Testing
import { OnDemandTestPage } from './pages/testing/OnDemandTestPage';
import { LoadTestPage } from './pages/testing/LoadTestPage';
import { SchemaChangesPage } from './pages/testing/SchemaChangesPage';

// Insights
import { EnvComparisonPage } from './pages/insights/EnvComparisonPage';
import { AlertsPage } from './pages/insights/AlertsPage';
import { AnalyticsPage } from './pages/insights/AnalyticsPage';

// Admin
import { SettingsPage } from './pages/admin/SettingsPage';

/** Persistent app shell wrapping all authenticated pages */
const AppShell: React.FC = () => (
  <div className="flex h-screen w-full bg-background overflow-hidden text-foreground transition-colors duration-200">
    <Sidebar />
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <Header />
      <main className="flex-1 overflow-y-auto flex flex-col relative">
        <Outlet />
      </main>
    </div>
    {/* API Detail slide-over panel — rendered on top of any page */}
    <ApiDetails />
  </div>
);

export function App() {
  return (
    <ApiProvider>
      <Routes>
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/monitoring/dashboard" replace />} />

        {/* Main app shell */}
        <Route element={<AppShell />}>
          {/* Monitoring */}
          <Route path="/monitoring/dashboard" element={<DashboardPage />} />
          <Route path="/monitoring/apis" element={<ApisPage />} />
          <Route path="/monitoring/apis/:id" element={<ApiDetailPage />} />

          {/* Testing */}
          <Route path="/testing/on-demand" element={<OnDemandTestPage />} />
          <Route path="/testing/load-tests" element={<LoadTestPage />} />
          <Route path="/testing/schema-changes" element={<SchemaChangesPage />} />

          {/* Insights */}
          <Route path="/insights/comparison" element={<EnvComparisonPage />} />
          <Route path="/insights/alerts" element={<AlertsPage />} />
          <Route path="/insights/analytics" element={<AnalyticsPage />} />

          {/* Admin */}
          <Route path="/admin/settings" element={<SettingsPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/monitoring/dashboard" replace />} />
        </Route>
      </Routes>
    </ApiProvider>
  );
}

export default App;
