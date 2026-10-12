import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  FileCheck,
  MapPin,
  Settings,
  Database,
  Shield,
  Clock,
  LogIn,
  X,
} from 'lucide-react';
import { Card } from '@/core/components';
import { useAuth } from '@/core/hooks/auth';
import {
  OperationsCenter,
  StateConfigPanel,
  DataGridPanel,
  ComplianceCenter,
  LoginAsModal,
} from './components';

type TabView = 'operations' | 'state-config' | 'data' | 'compliance';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>('operations');
  const [isLoginAsOpen, setIsLoginAsOpen] = useState(false);

  const tabs = [
    {
      id: 'operations' as const,
      label: 'Operations Center',
      icon: <Activity className="h-5 w-5" />,
      description: 'Live monitoring and exception management',
    },
    {
      id: 'state-config' as const,
      label: 'State Configuration',
      icon: <Settings className="h-5 w-5" />,
      description: 'Multi-state EVV compliance settings',
    },
    {
      id: 'data' as const,
      label: 'Data Management',
      icon: <Database className="h-5 w-5" />,
      description: 'Direct access to all system tables',
    },
    {
      id: 'compliance' as const,
      label: 'Compliance Center',
      icon: <Shield className="h-5 w-5" />,
      description: 'Audit trails and regulatory reports',
    },
  ];

  // Real-time stats (these would come from API in production)
  const stats = [
    {
      label: 'Active Visits',
      value: '23',
      icon: <Clock className="h-6 w-6 text-green-600" />,
      status: 'success' as const,
      change: '+3 from yesterday',
    },
    {
      label: 'EVV Exceptions',
      value: '7',
      icon: <AlertTriangle className="h-6 w-6 text-yellow-600" />,
      status: 'warning' as const,
      change: '2 critical, 5 warnings',
    },
    {
      label: 'Pending VMURs (TX)',
      value: '4',
      icon: <FileCheck className="h-6 w-6 text-blue-600" />,
      status: 'info' as const,
      change: 'All within deadline',
    },
    {
      label: 'Geofence Violations',
      value: '2',
      icon: <MapPin className="h-6 w-6 text-red-600" />,
      status: 'error' as const,
      change: 'Requires investigation',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Impersonation Banner */}
      {user && user.roles?.includes('CAREGIVER') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">
              You are currently logged in as a caregiver
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              This is an impersonation session. Your actions are being audited for compliance.
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('auth-storage');
              window.location.href = '/login';
            }}
            className="text-yellow-600 hover:text-yellow-800 flex-shrink-0"
            aria-label="End impersonation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Header with Login As Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive system administration and state-specific configuration
          </p>
        </div>
        {!user?.roles?.includes('CAREGIVER') && (
          <button
            onClick={() => setIsLoginAsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            <span className="text-sm font-medium">Login As Caregiver</span>
          </button>
        )}
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-600">{stat.change}</p>
              </div>
              <div className="shrink-0">{stat.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                group inline-flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm
                transition-colors duration-200
                ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'operations' && <OperationsCenter />}
        {activeTab === 'state-config' && <StateConfigPanel />}
        {activeTab === 'data' && <DataGridPanel />}
        {activeTab === 'compliance' && <ComplianceCenter />}
      </div>

      {/* Login As Modal */}
      <LoginAsModal
        isOpen={isLoginAsOpen}
        onClose={() => setIsLoginAsOpen(false)}
        onImpersonateStart={(accessToken, caregiver) => {
          // Store the new token and reload to update context
          localStorage.setItem(
            'auth-storage',
            JSON.stringify({
              state: {
                user: {
                  id: caregiver.id,
                  email: caregiver.email,
                  organizationId: user?.organizationId || '',
                  name: caregiver.name,
                  roles: ['CAREGIVER'],
                  permissions: [],
                },
                token: accessToken,
                isAuthenticated: true,
              },
              version: 0,
            })
          );
          window.location.reload();
        }}
      />
    </div>
  );
};
