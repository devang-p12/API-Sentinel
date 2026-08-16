import React from 'react';
import { Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface StubPageProps {
  title: string;
  description: string;
  icon?: React.ElementType;
}

export const StubPage: React.FC<StubPageProps> = ({ title, description, icon: Icon = Construction }) => (
  <div className="min-h-full bg-background p-6 lg:p-8">
    <div className="mx-auto max-w-7xl">
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
            <div className="rounded-xl border border-dashed bg-muted/30 p-4">
              <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{description}</p>
            </div>
            <Badge variant="outline" className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Coming Soon
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);
