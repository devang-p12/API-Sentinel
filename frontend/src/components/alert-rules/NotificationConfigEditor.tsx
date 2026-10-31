import { useState } from 'react';
import { type AlertRuleNotificationConfig, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Mail01Icon,
  Add01Icon,
  Cancel01Icon,
  Edit01Icon,
  CheckmarkCircle02Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons';

interface NotificationConfigEditorProps {
  value: AlertRuleNotificationConfig;
  onChange: (config: AlertRuleNotificationConfig) => void;
  ruleName?: string;
  ruleId?: string;
  error?: string;
}

export function NotificationConfigEditor({
  value,
  onChange,
  ruleName,
  ruleId,
  error,
}: NotificationConfigEditorProps) {
  const emailConfig = value.email || {
    enabled: true,
    recipients: [],
    onFiring: true,
    onResolved: true,
    repeatInterval: 0,
  };

  const [newEmail, setNewEmail] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Test email state
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const isValidEmail = (email: string) => {
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return re.test(email.trim());
  };

  const handleAddEmail = () => {
    setInputError(null);
    const trimmed = newEmail.trim();

    if (!trimmed) return;

    if (!isValidEmail(trimmed)) {
      setInputError('Please enter a valid email address (e.g. name@company.com)');
      return;
    }

    if (
      emailConfig.recipients.some(
        (r) => r.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setInputError('This recipient email is already added');
      return;
    }

    const updatedRecipients = [...emailConfig.recipients, trimmed];
    onChange({
      ...value,
      email: {
        ...emailConfig,
        recipients: updatedRecipients,
      },
    });

    setNewEmail('');
  };

  const handleRemoveEmail = (index: number) => {
    const updated = emailConfig.recipients.filter((_, idx) => idx !== index);
    onChange({
      ...value,
      email: {
        ...emailConfig,
        recipients: updated,
      },
    });
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(emailConfig.recipients[index] || '');
    setInputError(null);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingValue.trim();

    if (!isValidEmail(trimmed)) {
      setInputError('Please enter a valid email address');
      return;
    }

    const duplicateIndex = emailConfig.recipients.findIndex(
      (r, idx) => idx !== editingIndex && r.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicateIndex !== -1) {
      setInputError('This recipient email is already added');
      return;
    }

    const updated = [...emailConfig.recipients];
    updated[editingIndex] = trimmed;

    onChange({
      ...value,
      email: {
        ...emailConfig,
        recipients: updated,
      },
    });

    setEditingIndex(null);
    setEditingValue('');
    setInputError(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
    setInputError(null);
  };

  const handleToggleFiring = (checked: boolean) => {
    onChange({
      ...value,
      email: {
        ...emailConfig,
        onFiring: checked,
      },
    });
  };

  const handleToggleResolved = (checked: boolean) => {
    onChange({
      ...value,
      email: {
        ...emailConfig,
        onResolved: checked,
      },
    });
  };

  const handleRepeatChange = (minutes: number) => {
    onChange({
      ...value,
      email: {
        ...emailConfig,
        repeatInterval: minutes,
      },
    });
  };

  const handleSendTestEmail = async () => {
    setTestFeedback(null);
    setInputError(null);

    const recipients = emailConfig.recipients;
    if (recipients.length === 0) {
      setInputError('Add at least one email recipient before sending a test email');
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await api.sendAlertRuleTestEmail({
        recipients,
        ruleName: ruleName || 'Alert Rule Test',
        ruleId,
      });

      setTestFeedback({
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setTestFeedback({
        success: false,
        message: err.message || 'Failed to send test email',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Delivery Method Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-medium text-foreground block">
          Delivery method
        </label>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary/50 bg-primary/10 text-primary text-xs font-mono font-medium">
            <HugeiconsIcon icon={Mail01Icon} className="size-3.5" />
            <span>Email</span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            Direct email delivery
          </span>
        </div>
      </div>

      {/* Recipients Management */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono font-medium text-foreground block">
            Recipients
          </label>
          <span className="text-[10px] font-mono text-muted-foreground">
            {emailConfig.recipients.length} recipient{emailConfig.recipients.length !== 1 ? 's' : ''} configured
          </span>
        </div>

        {/* Current Recipients Chip List */}
        {emailConfig.recipients.length > 0 ? (
          <div className="border border-border bg-background p-2 space-y-1.5 min-h-[44px]">
            {emailConfig.recipients.map((recipient, idx) => {
              const isEditingThis = editingIndex === idx;

              if (isEditingThis) {
                return (
                  <div key={idx} className="flex items-center gap-1.5 bg-card p-1 border border-primary/40">
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEdit();
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      className="h-6 text-xs font-mono rounded-none py-0 px-2"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleSaveEdit}
                      title="Save edit"
                      className="text-emerald-400 hover:text-emerald-300 h-6 w-6"
                    >
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleCancelEdit}
                      title="Cancel edit"
                      className="text-muted-foreground hover:text-foreground h-6 w-6"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                    </Button>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="inline-flex items-center justify-between gap-2 px-2.5 py-1 mr-1.5 mb-1 bg-card border border-border text-xs font-mono text-foreground"
                >
                  <span className="select-all">{recipient}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(idx)}
                      title="Edit email recipient"
                      className="text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <HugeiconsIcon icon={Edit01Icon} className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(idx)}
                      title="Remove recipient"
                      className="text-muted-foreground hover:text-rose-400 p-0.5"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-border p-3 text-center text-xs font-mono text-muted-foreground">
            No recipients configured. Add at least one email address below.
          </div>
        )}

        {/* Add Recipient Input Row */}
        <div className="flex items-center gap-2">
          <Input
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              if (inputError) setInputError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddEmail();
              }
            }}
            placeholder="backend@example.com"
            className="text-xs font-mono h-8 rounded-none border-border"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddEmail}
            className="text-xs font-mono h-8 gap-1 shrink-0"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            <span>Add recipient</span>
          </Button>
        </div>

        {/* Validation Errors */}
        {inputError && (
          <p className="text-[11px] font-mono text-rose-400 mt-1">{inputError}</p>
        )}
        {error && !inputError && (
          <p className="text-[11px] font-mono text-rose-400 mt-1">{error}</p>
        )}
      </div>

      {/* Notification Events Checklist */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <label className="text-xs font-mono font-medium text-foreground block">
          Send notifications when
        </label>
        <div className="flex flex-col sm:flex-row gap-4 text-xs font-mono">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={emailConfig.onFiring !== false}
              onChange={(e) => handleToggleFiring(e.target.checked)}
              className="rounded-none border-border h-3.5 w-3.5 accent-primary"
            />
            <span className="text-foreground">Alert fires</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={emailConfig.onResolved !== false}
              onChange={(e) => handleToggleResolved(e.target.checked)}
              className="rounded-none border-border h-3.5 w-3.5 accent-primary"
            />
            <span className="text-foreground">Alert resolves</span>
          </label>
        </div>
      </div>

      {/* Repeat Notification Dropdown */}
      <div className="space-y-1.5 pt-2 border-t border-border/40">
        <label className="text-xs font-mono font-medium text-foreground block">
          Repeat notification
        </label>
        <div className="flex items-center gap-2">
          <select
            value={emailConfig.repeatInterval || 0}
            onChange={(e) => handleRepeatChange(parseInt(e.target.value, 10))}
            className="h-8 px-2.5 bg-background border border-border text-foreground font-mono text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={0}>Disabled</option>
            <option value={15}>Repeat every 15 minutes</option>
            <option value={30}>Repeat every 30 minutes</option>
            <option value={60}>Repeat every 1 hour</option>
            <option value={120}>Repeat every 2 hours</option>
            <option value={240}>Repeat every 4 hours</option>
          </select>
          <span className="text-[11px] text-muted-foreground font-mono">
            Resend reminder while alert remains active and firing
          </span>
        </div>
      </div>

      {/* Send Test Email Button & Inline Feedback */}
      <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSendTestEmail}
          disabled={isSendingTest || emailConfig.recipients.length === 0}
          className="text-xs font-mono gap-1.5 self-start"
          title="Send test email to verify delivery configuration"
        >
          <HugeiconsIcon
            icon={isSendingTest ? PlayIcon : Mail01Icon}
            className={`size-3.5 ${isSendingTest ? 'animate-spin' : ''}`}
          />
          <span>{isSendingTest ? 'Sending test email...' : 'Send test email'}</span>
        </Button>

        {testFeedback && (
          <div
            className={`px-3 py-1 text-xs font-mono border flex items-center justify-between gap-3 ${
              testFeedback.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{testFeedback.message}</span>
            <button
              type="button"
              onClick={() => setTestFeedback(null)}
              className="text-muted-foreground hover:text-foreground text-[10px]"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
