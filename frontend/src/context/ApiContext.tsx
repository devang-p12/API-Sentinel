import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { API, APIStatus } from '../types/api';

interface ApiContextType {
  apis: API[];
  addApi: (api: Omit<API, 'id' | 'createdAt' | 'status'>) => void;
  deleteApi: (id: string) => void;
  updateApi: (id: string, api: Partial<API>) => void;
  updateMonitoringConfig: (id: string, config: { monitoringEnabled: boolean; monitoringInterval: number; timeout: number; degradedThresholdMs: number }) => Promise<void>;
  currentRoute: 'dashboard' | 'register';
  setCurrentRoute: (route: 'dashboard' | 'register') => void;
  selectedApiId: string | null;
  setSelectedApiId: (id: string | null) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  envFilter: string;
  setEnvFilter: (env: string) => void;
  sortBy: 'name' | 'createdAt' | 'version';
  setSortBy: (sort: 'name' | 'createdAt' | 'version') => void;
  isRefreshing: boolean;
  refreshApis: () => void;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

const initialApis: API[] = [
  {
    id: 'api-1',
    name: 'Payment API',
    description: 'API responsible for handling payment operations and checkout services.',
    version: 'v1.2',
    baseUrl: 'https://api.company.com/payments',
    environment: 'Production',
    status: 'Active',
    healthEndpoint: '/health',
    healthMethod: 'GET',
    healthEnabled: true,
    authType: 'API Key',
    authConfig: {
      apiKeyName: 'X-Payment-Key',
      apiHeaderName: 'Authorization'
    },
    documentationUrl: 'https://docs.company.com/payments',
    tags: ['payments', 'critical', 'external'],
    createdAt: '2026-08-10T10:00:00Z',
    group: 'Payments'
  },
  {
    id: 'api-2',
    name: 'Authentication API',
    description: 'Central identity provider managing user registration, authentication, and scopes.',
    version: 'v2.0',
    baseUrl: 'https://api.company.com/auth',
    environment: 'Production',
    status: 'Active',
    healthEndpoint: '/health',
    healthMethod: 'POST',
    healthEnabled: true,
    authType: 'OAuth 2.0',
    authConfig: {
      clientId: 'auth-service-client-id',
      clientSecret: '••••••••••••••••••••••••',
      tokenUrl: 'https://api.company.com/auth/token'
    },
    documentationUrl: 'https://docs.company.com/auth',
    tags: ['auth', 'security', 'internal'],
    createdAt: '2026-08-11T14:30:00Z',
    group: 'Authentication'
  }
];

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apis, setApis] = useState<API[]>(() => {
    const saved = localStorage.getItem('api_sentinel_data');
    return saved ? JSON.parse(saved) : initialApis;
  });

  const [currentRoute, setCurrentRoute] = useState<'dashboard' | 'register'>('dashboard');
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('api_sentinel_theme');
    return (savedTheme as 'light' | 'dark') || 'dark';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'version'>('createdAt');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync theme with HTML class
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('api_sentinel_theme', theme);
  }, [theme]);

  // Load registered APIs from PostgreSQL Backend
  const loadApisFromBackend = useCallback(async () => {
    try {
      const response = await fetch('/api/apis');
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const mappedApis: API[] = data.data.map((item: any) => {
          const rawEnv = (item.environment || 'development').toLowerCase();
          const normalizedEnv =
            rawEnv === 'production'
              ? 'Production'
              : rawEnv === 'staging'
              ? 'Staging'
              : 'Development';

          return {
            id: String(item.id),
            name: item.name,
            description: item.description || '',
            version: item.version || 'v1',
            baseUrl: item.baseUrl || '',
            environment: normalizedEnv,
            status: (item.status as APIStatus) || 'Active',
            healthEndpoint: '/health',
            healthMethod: 'GET',
            healthEnabled: true,
            authType:
              item.authentication === 'api-key'
                ? 'API Key'
                : item.authentication === 'bearer'
                ? 'Bearer Token'
                : item.authentication === 'oauth2'
                ? 'OAuth 2.0'
                : 'None',
            authConfig: item.authConfig || {},
            tags: [rawEnv],
            createdAt: item.createdAt || new Date().toISOString(),
            group: 'Other',
            monitoringEnabled: item.monitoringEnabled || false,
            monitoringInterval: item.monitoringInterval || 60,
            timeout: item.timeout || 5000,
            degradedThresholdMs: item.degradedThresholdMs || 1000,
            healthStatus: item.healthStatus || 'HEALTHY',
            consecutiveFailures: item.consecutiveFailures || 0,
            lastMonitoredAt: item.lastMonitoredAt || null,
          };
        });

        setApis(mappedApis);
        localStorage.setItem('api_sentinel_data', JSON.stringify(mappedApis));
      }
    } catch (err) {
      console.warn('Backend not yet reachable, continuing with local cache:', err);
    }
  }, []);

  useEffect(() => {
    loadApisFromBackend();
  }, [loadApisFromBackend]);

  // Save APIs to localStorage when updated
  useEffect(() => {
    localStorage.setItem('api_sentinel_data', JSON.stringify(apis));
  }, [apis]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const addApi = (newApiData: Omit<API, 'id' | 'createdAt' | 'status'>) => {
    const newApi: API = {
      ...newApiData,
      id: `api-${Date.now()}`,
      status: 'Active',
      createdAt: new Date().toISOString()
    };
    setApis(prev => [newApi, ...prev]);
    setCurrentRoute('dashboard');
  };

  const deleteApi = async (id: string) => {
    // Optimistic UI removal
    setApis(prev => prev.filter(api => api.id !== id));
    if (selectedApiId === id) {
      setSelectedApiId(null);
    }

    // If ID is numeric, delete from PostgreSQL database
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      try {
        await fetch(`/api/apis/${numId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete API from database:', err);
      }
    }
  };

  const updateApi = (id: string, updatedFields: Partial<API>) => {
    setApis(prev =>
      prev.map(api => (api.id === id ? { ...api, ...updatedFields } : api))
    );
  };

  const updateMonitoringConfig = async (
    apiId: string, 
    config: { monitoringEnabled: boolean; monitoringInterval: number; timeout: number; degradedThresholdMs: number }
  ) => {
    const numId = parseInt(apiId, 10);
    if (isNaN(numId)) return;

    try {
      const response = await fetch(`/api/monitoring/${numId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        const updated = await response.json();
        updateApi(apiId, {
          monitoringEnabled: updated.monitoring_enabled,
          monitoringInterval: updated.monitoring_interval,
          timeout: updated.timeout,
          degradedThresholdMs: updated.degraded_threshold_ms
        });
      }
    } catch (err) {
      console.error('Failed to update monitoring config:', err);
    }
  };

  const refreshApis = () => {
    setIsRefreshing(true);
    loadApisFromBackend().finally(() => {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    });
  };

  return (
    <ApiContext.Provider
      value={{
        apis,
        addApi,
        deleteApi,
        updateApi,
        updateMonitoringConfig,
        currentRoute,
        setCurrentRoute,
        selectedApiId,
        setSelectedApiId,
        theme,
        toggleTheme,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        envFilter,
        setEnvFilter,
        sortBy,
        setSortBy,
        isRefreshing,
        refreshApis
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = () => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
