import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { ApiProvider } from "./context/ApiContext";
import AppLayout from "./layouts/AppLayout";
import { ApiDetails } from "./components/ApiDetails";

// Monitoring
import { DashboardPage } from "./pages/monitoring/DashboardPage";
import ApisPage from "./pages/monitoring/ApisPage";
import { ApiDetailPage } from "./pages/monitoring/ApiDetailPage";

// Testing
import { OnDemandTestPage } from "./pages/testing/OnDemandTestPage";
import { LoadTestPage } from "./pages/testing/LoadTestPage";
import { SchemaChangesPage } from "./pages/testing/SchemaChangesPage";

// Insights
import { EnvComparisonPage } from "./pages/insights/EnvComparisonPage";
import { AlertsPage } from "./pages/insights/AlertsPage";
import { GlobalAnalyticsPage } from "./pages/monitoring/GlobalAnalyticsPage";

// Admin
import { SettingsPage } from "./pages/admin/SettingsPage";

export function App() {
  return (
    <ApiProvider>
      <Routes>
        {/* Root */}
        <Route
          path="/"
          element={
            <Navigate
              to="/monitoring/dashboard"
              replace
            />
          }
        />

        {/* Application Layout */}
        <Route element={<AppLayout />}>
          {/* Monitoring */}
          <Route
            path="/monitoring/dashboard"
            element={<DashboardPage />}
          />

          <Route
            path="/monitoring/apis"
            element={<ApisPage />}
          />

          <Route
            path="/monitoring/apis/:id"
            element={<ApiDetailPage />}
          />

          {/* Testing */}
          <Route
            path="/testing/on-demand"
            element={<OnDemandTestPage />}
          />

          <Route
            path="/testing/load-tests"
            element={<LoadTestPage />}
          />

          <Route
            path="/testing/schema-changes"
            element={<SchemaChangesPage />}
          />

          {/* Insights */}
          <Route
            path="/insights/comparison"
            element={<EnvComparisonPage />}
          />

          <Route
            path="/insights/alerts"
            element={<AlertsPage />}
          />

          <Route
            path="/insights/analytics"
            element={<GlobalAnalyticsPage />}
          />

          {/* Admin */}
          <Route
            path="/admin/settings"
            element={<SettingsPage />}
          />

          {/* Catch-all */}
          <Route
            path="*"
            element={
              <Navigate
                to="/monitoring/dashboard"
                replace
              />
            }
          />
        </Route>
      </Routes>
      <ApiDetails />
    </ApiProvider>
  );
}

export default App;