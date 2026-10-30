import React, { useState } from 'react';
import { Card } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js';
import { Shield, FileText, Eye, Download, AlertTriangle, CheckCircle } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  ipAddress: string;
  status: 'success' | 'failure';
}

interface HIPAAAccessLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  phi_accessed: string;
  clientId: string;
  clientName: string;
  purpose: string;
}

interface ComplianceReport {
  id: string;
  name: string;
  category: 'evv' | 'hipaa' | 'state' | 'billing';
  description: string;
  lastGenerated: Date;
  frequency: 'daily' | 'weekly' | 'monthly';
}

// Mock data with fixed timestamps to avoid impure Date.now() calls during render
const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: '1',
    timestamp: new Date('2024-01-15T14:45:00Z'),
    userId: 'user-1',
    userName: 'Admin User',
    action: 'UPDATE',
    resource: 'client/123',
    ipAddress: 'XX.XX.XX.100', // Placeholder for real IP
    status: 'success',
  },
  {
    id: '2',
    timestamp: new Date('2024-01-15T14:15:00Z'),
    userId: 'user-2',
    userName: 'Coordinator Smith',
    action: 'DELETE',
    resource: 'visit/456',
    ipAddress: 'XX.XX.XX.101', // Placeholder for real IP
    status: 'failure',
  },
  {
    id: '3',
    timestamp: new Date('2024-01-15T13:00:00Z'),
    userId: 'user-3',
    userName: 'Supervisor Johnson',
    action: 'APPROVE',
    resource: 'vmur/789',
    ipAddress: 'XX.XX.XX.102', // Placeholder for real IP
    status: 'success',
  },
];

const MOCK_HIPAA_LOGS: HIPAAAccessLog[] = [
  {
    id: '1',
    timestamp: new Date('2024-01-15T14:30:00Z'),
    userId: 'user-1',
    userName: 'Admin User',
    phi_accessed: 'Medical History',
    clientId: 'client-123',
    clientName: 'John Doe',
    purpose: 'Care Plan Update',
  },
  {
    id: '2',
    timestamp: new Date('2024-01-15T13:30:00Z'),
    userId: 'user-4',
    userName: 'Caregiver Wilson',
    phi_accessed: 'Medication List',
    clientId: 'client-456',
    clientName: 'Jane Smith',
    purpose: 'Visit Documentation',
  },
];

const COMPLIANCE_REPORTS: ComplianceReport[] = [
  {
    id: '1',
    name: 'Texas EVV Aggregator Submissions',
    category: 'evv',
    description: 'Daily submission status to HHAeXchange for Texas Medicaid',
    lastGenerated: new Date('2024-01-15T13:00:00Z'),
    frequency: 'daily',
  },
  {
    id: '2',
    name: 'Florida MCO Compliance Report',
    category: 'evv',
    description: 'Weekly EVV compliance metrics for Florida MCOs',
    lastGenerated: new Date('2024-01-14T15:00:00Z'),
    frequency: 'weekly',
  },
  {
    id: '3',
    name: 'HIPAA Access Audit Report',
    category: 'hipaa',
    description: 'Monthly PHI access audit for HIPAA compliance',
    lastGenerated: new Date('2024-01-08T15:00:00Z'),
    frequency: 'monthly',
  },
  {
    id: '4',
    name: 'State Regulatory Filings',
    category: 'state',
    description: 'Quarterly state regulatory compliance submissions',
    lastGenerated: new Date('2023-12-15T15:00:00Z'),
    frequency: 'monthly',
  },
];

const CATEGORY_COLORS = {
  evv: 'bg-green-50 text-green-700 border-green-200',
  hipaa: 'bg-blue-50 text-blue-700 border-blue-200',
  state: 'bg-purple-50 text-purple-700 border-purple-200',
  billing: 'bg-orange-50 text-orange-700 border-orange-200',
};

export const ComplianceCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'hipaa' | 'reports'>('audit');

  const formatDuration = (date: Date) => {
    const now = new Date();
    const minutes = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Compliance Center</h2>
          <p className="text-sm text-gray-600 mt-1">
            Audit trails, HIPAA access logs, and regulatory reports
          </p>
        </div>
      </div>

      {/* Tab Navigation & Content */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'audit' | 'hipaa' | 'reports')}
        className="space-y-6"
      >
        <div className="border-b border-gray-200 pb-2">
          <TabsList variant="line" className="space-x-2">
            {[
              { id: 'audit' as const, label: 'Audit Trail' },
              { id: 'hipaa' as const, label: 'HIPAA Access Logs' },
              { id: 'reports' as const, label: 'Compliance Reports' },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-secondary"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="mt-0">
          <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">System Audit Trail</h3>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_AUDIT_LOGS.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-gray-900">
                    {formatDuration(log.timestamp)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {log.userName}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 font-mono">
                    {log.resource}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 font-mono">
                    {log.ipAddress}
                  </TableCell>
                  <TableCell>
                    {log.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* HIPAA Access Logs Tab */}
      <TabsContent value="hipaa" className="mt-0">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">HIPAA PHI Access Logs</h3>
              <p className="text-sm text-gray-600 mt-1">
                Protected Health Information access tracking for HIPAA compliance
              </p>
            </div>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>PHI Accessed</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_HIPAA_LOGS.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-gray-900">
                    {formatDuration(log.timestamp)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {log.userName}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                      {log.phi_accessed}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {log.clientName}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {log.purpose}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* Compliance Reports Tab */}
      <TabsContent value="reports" className="mt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPLIANCE_REPORTS.map((report) => (
            <Card key={report.id} className="p-6 transition-all hover:shadow-md">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-500" />
                      <h3 className="font-semibold text-gray-900">{report.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded border ${
                      CATEGORY_COLORS[report.category]
                    }`}
                  >
                    {report.category.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Last generated: {formatDuration(report.lastGenerated)}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                    {report.frequency}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-200">
                  <Button variant="secondary" className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary/80 transition-colors">
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button variant="outline" className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </TabsContent>
      </Tabs>
    </div>
  );
};
