import React from 'react';
import { Settings } from 'lucide-react';
import { StubPage } from '@/components/shared/StubPage';

export const SettingsPage: React.FC = () => (
  <StubPage
    icon={Settings}
    title="Settings & Admin"
    description="Manage users, stored API credentials, and notification channels (Slack, email, webhook) for alert routing and team access control."
  />
);
