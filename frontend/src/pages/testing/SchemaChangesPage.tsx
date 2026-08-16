import React from 'react';
import { FileSearch } from 'lucide-react';
import { StubPage } from '@/components/shared/StubPage';

export const SchemaChangesPage: React.FC = () => (
  <StubPage
    icon={FileSearch}
    title="Schema Changes"
    description="Track response schema drift over time with a side-by-side diff viewer and timeline of breaking changes across environments."
  />
);
