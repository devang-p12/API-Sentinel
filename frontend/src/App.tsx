import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { ApisPage } from "@/pages/ApisPage"
import { ApiDetailPage } from "@/pages/ApiDetailPage"
import { MonitorsPage } from "@/pages/MonitorsPage"
import { MonitorDetailPage } from "@/pages/MonitorDetailPage"
import { IncidentsPage } from "@/pages/IncidentsPage"
import { AlertsPage } from "@/pages/AlertsPage"
import { DashboardsPage } from "@/pages/DashboardsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="apis" element={<ApisPage />} />
          <Route path="apis/:id" element={<ApiDetailPage />} />
          <Route path="monitors" element={<MonitorsPage />} />
          <Route path="monitors/:id" element={<MonitorDetailPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="dashboards" element={<DashboardsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
