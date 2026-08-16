import React from 'react';
import { Zap } from 'lucide-react';
import { StubPage } from '@/components/shared/StubPage';

export const OnDemandTestPage: React.FC = () => (
  <StubPage
    icon={Zap}
    title="On-Demand Test"
    description="Fire a one-off HTTP request against any registered API and inspect the response headers, body, and latency."
  />
);
