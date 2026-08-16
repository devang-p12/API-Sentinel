import React from 'react';
import { BarChart3 } from 'lucide-react';
import { StubPage } from '@/components/shared/StubPage';

export const AnalyticsPage: React.FC = () => (
  <StubPage
    icon={BarChart3}
    title="Analytics"
    description="Explore uptime trends, p95 latency, and incident statistics over a selectable time range with interactive Recharts visualisations."
  />
);
