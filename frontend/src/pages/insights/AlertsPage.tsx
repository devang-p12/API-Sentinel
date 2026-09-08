import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IncidentsPage } from './IncidentsPage';
import { AlertRulesPage } from './AlertRulesPage';

export const AlertsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('incidents');

  return (
    <div className="min-h-full bg-background">
      <Tabs
        defaultValue="incidents"
        value={activeTab}
        onValueChange={(val) => val && setActiveTab(val)}
        className="w-full"
      >
        <div className="border-b bg-background px-6 py-3 lg:px-8">
          <TabsList>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="incidents" className="mt-0 outline-none">
          <IncidentsPage />
        </TabsContent>

        <TabsContent value="rules" className="mt-0 outline-none">
          <AlertRulesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlertsPage;
