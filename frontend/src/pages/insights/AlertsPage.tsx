import React from 'react';
import { BellRing } from 'lucide-react';
import { StubPage } from '@/components/shared/StubPage';

export const AlertsPage: React.FC = () => (
  <StubPage
    icon={BellRing}
    title="Alerts & Incidents"
    description="Configure threshold-based alerts per API and review the full incident history with severity, duration, and resolution timelines."
  />
);
