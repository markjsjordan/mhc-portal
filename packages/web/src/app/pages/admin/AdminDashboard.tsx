import React, { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import {
  Card,
  CardContent,
} from '@/components/ui/card.js';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert.js';
import { useAuth } from '@/core/hooks/auth';
import {
  OperationsCenter,
  StateConfigPanel,
  DataGridPanel,
  ComplianceCenter,
  LoginAsModal,
} from './components';
import { X } from 'lucide-react';

type TabView = 'operations' | 'state-config' | 'data' | 'compliance';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>('operations');
  const [isLoginAsOpen, setIsLoginAsOpen] = useState(false);

  const tabs = [
    {
      id: 'operations' as const,
      label: 'Operations Center',
      icon: '📊',
      description: 'Live monitoring and exception management',
    },
    {
      id: 'state-config' as const,
      label: 'State Configuration',
      icon: '⚙️',
      description: 'Multi-state EVV compliance settings',
    },
    {
      id: 'data' as const,
      label: 'Data Management',
      icon: '🗄️',
      description: 'Direct access to all system tables',
    },
    {
      id: 'compliance' as const,
      label: 'Compliance Center',
      icon: '🛡️',
      description: 'Audit trails and regulatory reports',
    },
  ];

  // Real-time stats (these would come from API in production)
  const stats = [
    {
      label: 'Active Visits',
      value: '23',
      icon: '🕐',
      status: 'success' as const,
      change: '+3 from yesterday',
    },
    {
      label: 'EVV Exceptions',
      value: '7',
      icon: '⚠️',
      status: 'warning' as const,
      change: '2 critical, 5 warnings',
    },
    {
      label: 'Pending VMURs (TX)',
      value: '4',
      icon: '📋',
      status: 'info' as const,
      change: 'All within deadline',
    },
    {
      label: 'Geofence Violations',
      value: '2',
      icon: '📍',
      status: 'error' as const,
      change: 'Requires investigation',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Impersonation Banner */}
      {Boolean(user?.roles.includes('CAREGIVER')) && (
        <Alert variant="destructive">
          <AlertTitle>Impersonation Active</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              You are currently logged in as a caregiver. This is an impersonation session. Your actions are being audited for compliance.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem('auth-storage');
                window.location.href = '/login';
              }}
              aria-label="End impersonation"
            >
              <X className="h-5 w-5" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Login As Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive system administration and state-specific configuration
          </p>
        </div>
        {!user?.roles.includes('CAREGIVER') && (
          <Button
            onClick={() => setIsLoginAsOpen(true)}
            className="flex items-center gap-2"
          >
            <span className="text-sm font-medium">Login As Caregiver</span>
          </Button>
        )}
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="mt-1 text-sm text-gray-600">{stat.change}</p>
                </div>
                <div className="shrink-0 text-2xl">{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className="gap-2"
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Button>
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
                  organizationId: user?.organizationId ?? '',
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
