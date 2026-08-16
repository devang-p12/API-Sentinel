import React from 'react';
import { GitCompare } from 'lucide-react';
import { StubPage } from '@/components/shared/StubPage';

export const EnvComparisonPage: React.FC = () => (
  <StubPage
    icon={GitCompare}
    title="Environment Comparison"
    description="Compare an API's behaviour across Dev, Staging, and Production environments side-by-side — status, latency, and schema diffs."
  />
);
