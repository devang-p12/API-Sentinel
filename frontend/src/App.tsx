import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AppLayout } from "@/components/layout/AppLayout"
import { LoginPage } from "@/pages/LoginPage"
import { RegisterPage } from "@/pages/RegisterPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { ApisPage } from "@/pages/ApisPage"
import { ApiDetailPage } from "@/pages/ApiDetailPage"
import { ApiTesterPage } from "@/pages/ApiTesterPage"
import { MonitorsPage } from "@/pages/MonitorsPage"
import { MonitorDetailPage } from "@/pages/MonitorDetailPage"
import { ContractsPage } from "@/pages/ContractsPage"
import { LoadTestsListPage } from "@/pages/LoadTestsListPage"
import { CreateLoadTestPage } from "@/pages/CreateLoadTestPage"
import { LoadTestDetailPage } from "@/pages/LoadTestDetailPage"
import { IncidentsPage } from "@/pages/IncidentsPage"
import { AlertRulesListPage } from "@/pages/AlertRulesListPage"
import { CreateAlertRulePage } from "@/pages/CreateAlertRulePage"
import { EditAlertRulePage } from "@/pages/EditAlertRulePage"
import { AlertRuleDetailPage } from "@/pages/AlertRuleDetailPage"
import { AlertsPage } from "@/pages/AlertsPage"
import { ContactPointsPage } from "@/pages/ContactPointsPage"
import { NotificationPoliciesPage } from "@/pages/NotificationPoliciesPage"
import { NotificationHistoryPage } from "@/pages/NotificationHistoryPage"
import { DashboardsPage } from "@/pages/DashboardsPage"
import { DashboardViewPage } from "@/pages/DashboardViewPage"
import { AnalyticsPage } from "@/pages/AnalyticsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          {/* Protected Sentinel Dashboard Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="apis" element={<ApisPage />} />
              <Route path="apis/:id" element={<ApiDetailPage />} />
              <Route path="api-tester" element={<ApiTesterPage />} />
              <Route path="monitors" element={<MonitorsPage />} />
              <Route path="monitors/:id" element={<MonitorDetailPage />} />
              <Route path="contracts" element={<ContractsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="load-tests" element={<LoadTestsListPage />} />
              <Route path="load-tests/new" element={<CreateLoadTestPage />} />
              <Route path="load-tests/:id" element={<LoadTestDetailPage />} />
              <Route path="incidents" element={<IncidentsPage />} />
              <Route path="alert-rules" element={<AlertRulesListPage />} />
              <Route path="alert-rules/new" element={<CreateAlertRulePage />} />
              <Route path="alert-rules/:id" element={<AlertRuleDetailPage />} />
              <Route path="alert-rules/:id/edit" element={<EditAlertRulePage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="contact-points" element={<ContactPointsPage />} />
              <Route path="notification-policies" element={<NotificationPoliciesPage />} />
              <Route path="notification-history" element={<NotificationHistoryPage />} />
              <Route path="dashboards" element={<DashboardsPage />} />
              <Route path="dashboards/:id" element={<DashboardViewPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

