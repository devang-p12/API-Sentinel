import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { AlertRuleBuilder } from '@/components/alert-rules/AlertRuleBuilder';
import { type AlertRule } from '@/lib/api';

export function CreateAlertRulePage() {
  const navigate = useNavigate();

  const handleSuccess = (createdRule: AlertRule) => {
    navigate(`/alert-rules/${createdRule.id}`);
  };

  const handleCancel = () => {
    navigate('/alert-rules');
  };

  return (
    <PageContainer
      title="Create alert rule"
      description="Configure the condition that triggers this rule."
      breadcrumbs={[
        { label: 'Alert Rules', href: '/alert-rules' },
        { label: 'New alert rule' },
      ]}
    >
      <AlertRuleBuilder onSuccess={handleSuccess} onCancel={handleCancel} />
    </PageContainer>
  );
}
