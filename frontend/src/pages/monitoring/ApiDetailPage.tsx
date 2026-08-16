import React from 'react';
import { Globe } from 'lucide-react';
import { StubPage } from '@/components/shared/StubPage';

export const ApiDetailPage: React.FC = () => (
  <StubPage
    icon={Globe}
    title="API Detail"
    description="View real-time health, response-time trends, check history, and schema drift for a single API endpoint."
  />
);
