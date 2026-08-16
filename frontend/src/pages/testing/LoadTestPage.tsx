import React from 'react';
import { Layers } from 'lucide-react';
import { StubPage } from '@/components/shared/StubPage';

export const LoadTestPage: React.FC = () => (
  <StubPage
    icon={Layers}
    title="Load Testing"
    description="Simulate concurrent virtual users, configure test duration, and view latency, throughput, and error-rate results in real time."
  />
);
