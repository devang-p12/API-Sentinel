import React, { useState } from 'react';
import { useApi } from '../context/ApiContext';
import type { APIGroup, APIEnvironment, APIAuthType } from '../types/api';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import {
  Info,
  Settings,
  Activity,
  Lock,
  Tag,
  X,
  ArrowLeft
} from 'lucide-react';

export const RegisterForm: React.FC = () => {
  const { addApi, setCurrentRoute } = useApi();

  // Section 1: API Information
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('v1.0');
  const [group, setGroup] = useState<APIGroup>('Payments');

  // Section 2: API Configuration
  const [baseUrl, setBaseUrl] = useState('');
  const [environment, setEnvironment] = useState<APIEnvironment>('Production');
  const [documentationUrl, setDocumentationUrl] = useState('');

  // Section 3: Health Check
  const [healthEndpoint, setHealthEndpoint] = useState('/health');
  const [healthMethod, setHealthMethod] = useState<'GET' | 'POST'>('GET');
  const [healthEnabled, setHealthEnabled] = useState(true);

  // Section 4: Authentication
  const [authType, setAuthType] = useState<APIAuthType>('None');
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiHeaderName, setApiHeaderName] = useState('Authorization');
  const [tokenValue, setTokenValue] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tokenUrl, setTokenUrl] = useState('');

  // Section 5: Tags
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Validation state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags(prev => [...prev, newTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = 'API Name is required';
    if (!version.trim()) newErrors.version = 'API Version is required';
    if (!baseUrl.trim()) {
      newErrors.baseUrl = 'Base URL is required';
    } else {
      try {
        new URL(baseUrl);
      } catch {
        newErrors.baseUrl = 'Must be a valid URL starting with http:// or https://';
      }
    }

    if (healthEnabled && !healthEndpoint.trim()) {
      newErrors.healthEndpoint = 'Health endpoint path is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorKey = Object.keys(newErrors)[0];
      const errorEl = document.getElementById(`input-${firstErrorKey}`);
      if (errorEl) {
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const authConfig: any = {};
    if (authType === 'API Key') {
      authConfig.apiKeyName = apiKeyName;
      authConfig.apiHeaderName = apiHeaderName;
    } else if (authType === 'Bearer Token') {
      authConfig.tokenValue = tokenValue;
    } else if (authType === 'OAuth 2.0') {
      authConfig.clientId = clientId;
      authConfig.clientSecret = clientSecret;
      authConfig.tokenUrl = tokenUrl;
    }

    addApi({
      name,
      description,
      version,
      group,
      baseUrl,
      environment,
      documentationUrl: documentationUrl || undefined,
      healthEndpoint,
      healthMethod,
      healthEnabled,
      authType,
      authConfig: authType !== 'None' ? authConfig : undefined,
      tags
    });
  };

  return (
    <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-slate-50/20 dark:bg-slate-950/20 text-slate-800 dark:text-slate-100">

      {/* Back link */}
      <button
        onClick={() => setCurrentRoute('dashboard')}
        className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 transition-colors uppercase tracking-widest mb-4 cursor-pointer"
      >
        <ArrowLeft size={12} />
        <span>Back to APIs</span>
      </button>

      {/* Page Header */}
      <div className="mb-6 text-left">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight m-0 text-slate-900 dark:text-slate-50">
          Register API
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Add a new backend endpoint to the platform directory database.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5 text-left">

        {/* Section 1: API Information */}
        <div className="p-5 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 card-shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
            <Info size={14} className="text-slate-550 dark:text-slate-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              1. API Information
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                id="input-name"
                label="API Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Payment API"
                error={errors.name}
              />
            </div>
            <div>
              <Input
                id="input-version"
                label="API Version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0"
                error={errors.version}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="API endpoint details, response targets, and description details."
                rows={3}
                className="w-full px-3 py-1.5 text-xs rounded-md border bg-transparent text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-300 focus:border-slate-400 dark:focus:border-slate-700 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                API Group
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value as APIGroup)}
                className="w-full px-3 py-1.5 text-xs rounded-md border bg-transparent text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-350 focus:border-slate-400 dark:focus:border-slate-700 transition-all cursor-pointer"
              >
                <option value="Payments">Payments</option>
                <option value="Authentication">Authentication</option>
                <option value="Users">Users</option>
                <option value="Orders">Orders</option>
                <option value="Notifications">Notifications</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: API Configuration */}
        <div className="p-5 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 card-shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
            <Settings size={14} className="text-slate-550 dark:text-slate-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              2. API Configuration
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                id="input-baseUrl"
                label="Base URL"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.company.com"
                error={errors.baseUrl}
                helperText="Fully qualified domain URL where the target service resides."
              />
            </div>
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as APIEnvironment)}
                className="w-full px-3 py-1.5 text-xs rounded-md border bg-transparent text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-355 focus:border-slate-400 dark:focus:border-slate-700 transition-all cursor-pointer"
              >
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="Development">Development</option>
              </select>
            </div>
          </div>

          <div className="w-full">
            <Input
              label="Documentation URL"
              value={documentationUrl}
              onChange={(e) => setDocumentationUrl(e.target.value)}
              placeholder="https://docs.company.com/api"
            />
          </div>
        </div>

        {/* Section 3: Health Check */}
        <div className="p-5 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-888 card-shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-slate-555 dark:text-slate-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                3. Health Check
              </h3>
            </div>

            {/* Toggle switch for Enable Health Check */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {healthEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                type="button"
                onClick={() => setHealthEnabled(prev => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${healthEnabled ? 'bg-slate-900 dark:bg-slate-50' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out ${healthEnabled
                    ? 'translate-x-4 bg-white dark:bg-slate-950'
                    : 'translate-x-0 bg-white dark:bg-slate-400'
                    }`}
                />
              </button>
            </div>
          </div>

          {healthEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">
              <div className="md:col-span-2">
                <Input
                  id="input-healthEndpoint"
                  label="Health Check Endpoint"
                  value={healthEndpoint}
                  onChange={(e) => setHealthEndpoint(e.target.value)}
                  placeholder="/health"
                  error={errors.healthEndpoint}
                />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  HTTP Method
                </label>
                <select
                  value={healthMethod}
                  onChange={(e) => setHealthMethod(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs rounded-md border bg-transparent text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-950 dark:focus:ring-slate-350 focus:border-slate-400 dark:focus:border-slate-700 transition-all cursor-pointer"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Authentication */}
        <div className="p-5 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 card-shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
            <Lock size={14} className="text-slate-550 dark:text-slate-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              4. Authentication Configuration
            </h3>
          </div>

          {/* Authentication Type Select */}
          <div className="flex flex-col gap-2 text-left">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Authentication Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['None', 'API Key', 'Bearer Token', 'OAuth 2.0'] as APIAuthType[]).map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setAuthType(type)}
                  className={`py-1.5 px-3 text-[11px] font-bold uppercase rounded-md border transition-cozy cursor-pointer ${authType === type
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-50 shadow-3xs'
                    : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Input Fields */}
          {authType === 'API Key' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 fade-in">
              <Input
                label="API Key Name"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="X-API-Key"
              />
              <Input
                label="Header Name"
                value={apiHeaderName}
                onChange={(e) => setApiHeaderName(e.target.value)}
                placeholder="Authorization"
              />
            </div>
          )}

          {authType === 'Bearer Token' && (
            <div className="pt-1 fade-in">
              <Input
                label="Bearer Token Value"
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              />
            </div>
          )}

          {authType === 'OAuth 2.0' && (
            <div className="space-y-4 pt-1 fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="client_id_dev_123"
                />
                <Input
                  label="Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  type="password"
                />
              </div>
              <Input
                label="Token URL"
                value={tokenUrl}
                onChange={(e) => setTokenUrl(e.target.value)}
                placeholder="https://api.company.com/oauth/token"
              />
            </div>
          )}
        </div>

        {/* Section 5: Tags */}
        <div className="p-5 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 card-shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
            <Tag size={14} className="text-slate-550 dark:text-slate-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              5. Tags & Classifications
            </h3>
          </div>

          <div className="space-y-3">
            <Input
              label="Add Tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type tag name and press Enter (e.g. payments, internal)"
              helperText="Press Enter or comma to append tag chip."
            />

            {/* Display tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 fade-in">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Form Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-850">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer font-semibold text-xs h-8"
            onClick={() => setCurrentRoute('dashboard')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="cursor-pointer font-semibold text-xs h-8"
          >
            Register API
          </Button>
        </div>
      </form>
    </div>
  );
};
