import React, { createContext, useContext, useState, useEffect } from 'react';
import type { API, APIStatus } from '../types/api';


interface ApiContextType {
  apis: API[];
  addApi: (api: Omit<API, 'id' | 'createdAt' | 'status'>) => void;
  deleteApi: (id: string) => void;
  updateApi: (id: string, api: Partial<API>) => void;
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
  },
  {
    id: 'api-3',
    name: 'User Service',
    description: 'Manages user profiles, preferences, and organization mapping.',
    version: 'v1.4',
    baseUrl: 'https://api.company.com/users',
    environment: 'Staging',
    status: 'Active',
    healthEndpoint: '/healthz',
    healthMethod: 'GET',
    healthEnabled: true,
    authType: 'Bearer Token',
    authConfig: {
      tokenValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    },
    documentationUrl: 'https://docs.company.com/users',
    tags: ['users', 'internal'],
    createdAt: '2026-08-12T09:15:00Z',
    group: 'Users'
  },
  {
    id: 'api-4',
    name: 'Notification API',
    description: 'Relays email, push alerts, and SMS text message payloads to external microservices.',
    version: 'v1.0',
    baseUrl: 'https://api.company.com/notifications',
    environment: 'Development',
    status: 'Inactive',
    healthEndpoint: '/health/status',
    healthMethod: 'GET',
    healthEnabled: false,
    authType: 'None',
    tags: ['notifications', 'async'],
    createdAt: '2026-08-14T17:45:00Z',
    group: 'Notifications'
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
    return (savedTheme as 'light' | 'dark') || 'dark'; // Dark theme first by default
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'version'>('createdAt');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Save APIs to localStorage when they change
  useEffect(() => {
    localStorage.setItem('api_sentinel_data', JSON.stringify(apis));
  }, [apis]);

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

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const addApi = (newApiData: Omit<API, 'id' | 'createdAt' | 'status'>) => {
    const newApi: API = {
      ...newApiData,
      id: `api-${Date.now()}`,
      status: 'Active', // Default status for new APIs
      createdAt: new Date().toISOString()
    };
    setApis(prev => [newApi, ...prev]);
    setCurrentRoute('dashboard');
  };

  const deleteApi = (id: string) => {
    setApis(prev => prev.filter(api => api.id !== id));
    if (selectedApiId === id) {
      setSelectedApiId(null);
    }
  };

  const updateApi = (id: string, updatedFields: Partial<API>) => {
    setApis(prev =>
      prev.map(api => (api.id === id ? { ...api, ...updatedFields } : api))
    );
  };

  const refreshApis = () => {
    setIsRefreshing(true);
    // Simulate API health check refresh delays
    setTimeout(() => {
      setApis(prev =>
        prev.map(api => {
          if (!api.healthEnabled) return api;
          // Randomly change status to add dynamic element to monitoring simulation
          // 90% chance it is active
          const nextStatus: APIStatus = Math.random() > 0.1 ? 'Active' : 'Inactive';
          return { ...api, status: nextStatus };
        })
      );
      setIsRefreshing(false);
    }, 1200);
  };

  return (
    <ApiContext.Provider
      value={{
        apis,
        addApi,
        deleteApi,
        updateApi,
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
