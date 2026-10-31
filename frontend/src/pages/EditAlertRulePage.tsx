import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type AlertRule } from '@/lib/api';
import { PageContainer } from '@/components/layout/PageContainer';
import { AlertRuleBuilder } from '@/components/alert-rules/AlertRuleBuilder';
import { Button } from '@/components/ui/button';

export function EditAlertRulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rule, setRule] = useState<AlertRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    async function loadRule() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getAlertRule(id as string);
        if (isMounted) {
          setRule(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load alert rule.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRule();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSuccess = (updatedRule: AlertRule) => {
    navigate(`/alert-rules/${updatedRule.id}`);
  };

  const handleCancel = () => {
    if (id) {
      navigate(`/alert-rules/${id}`);
    } else {
      navigate('/alert-rules');
    }
  };

  if (isLoading) {
    return (
      <PageContainer
        title="Edit alert rule"
        breadcrumbs={[
          { label: 'Alert Rules', href: '/alert-rules' },
          { label: 'Loading...' },
        ]}
      >
        <div className="p-12 text-center text-xs font-mono text-muted-foreground space-y-2 border border-border bg-card">
          <span className="inline-block size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div>Loading alert rule configuration...</div>
        </div>
      </PageContainer>
    );
  }

  if (error || !rule) {
    return (
      <PageContainer
        title="Edit alert rule"
        breadcrumbs={[
          { label: 'Alert Rules', href: '/alert-rules' },
          { label: 'Error' },
        ]}
      >
        <div className="p-8 border border-border bg-card text-center space-y-4">
          <p className="text-xs text-rose-400 font-mono">{error || 'Alert rule not found.'}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/alert-rules')}
            className="text-xs font-mono"
          >
            Return to alert rules
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`Edit ${rule.name}`}
      description="Modify the condition, scope, threshold, and labels for this alert rule."
      breadcrumbs={[
        { label: 'Alert Rules', href: '/alert-rules' },
        { label: rule.name, href: `/alert-rules/${rule.id}` },
        { label: 'Edit' },
      ]}
    >
      <AlertRuleBuilder
        initialData={rule}
        isEditing
        ruleId={rule.id}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </PageContainer>
  );
}
