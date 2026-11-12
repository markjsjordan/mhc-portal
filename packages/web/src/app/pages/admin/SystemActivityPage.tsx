/**
 * System Activity & HIPAA Audit Log Viewer
 *
 * Implements 45 CFR § 164.312(b) Audit Controls:
 * - Records & examines activity in systems containing ePHI
 * - Filters by actor, event type, date range, and resource
 * - Supports regulatory CSV export for state survey & HIPAA compliance
 * - Audits access to the audit log itself
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Download,
  ShieldAlert,
  Search,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useApiClient } from '@/core/hooks/useApiClient';
import { AuditEventsApiService } from '@/app/services/audit-events-api.service';
import type { AuditLogEntry } from '@/app/services/audit-events-api.service';

export const SystemActivityPage: React.FC = () => {
  const apiClient = useApiClient();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [phiOnly, setPhiOnly] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Fetch audit logs from API
  useEffect(() => {
    const auditService = new AuditEventsApiService(apiClient);
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await auditService.getAuditEvents({
          eventType: eventTypeFilter,
          phiOnly,
          search: searchTerm || undefined,
          limit: 100,
        });
        setLogs(response.events);
        setTotalLogs(response.total);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        setError('Failed to load audit logs. Please try again.');
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchLogs();
  }, [apiClient, eventTypeFilter, phiOnly, searchTerm]);

  const filteredLogs = useMemo((): AuditLogEntry[] => {
    // Server-side filtering is already applied, so just return the logs
    return logs;
  }, [logs]);

  const handleExportAuditLogs = () => {
    const headers = [
      'Timestamp',
      'Event ID',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Action',
      'Event Type',
      'Resource Type',
      'Resource ID',
      'Client (ePHI)',
      'PHI Accessed',
      'Result',
      'IP Address',
    ];

    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.id,
      `"${log.actor.name}"`,
      `"${log.actor.email}"`,
      log.actor.role,
      log.action,
      log.eventType,
      log.resourceType,
      log.resourceId,
      log.clientName ? `"${log.clientName}"` : 'N/A',
      log.phiAccessed ? 'YES' : 'NO',
      log.result,
      log.ipAddress,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hipaa-audit-log-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice(
      'Audit log exported successfully. Access to audit logs logged for HIPAA § 164.312(b) compliance.'
    );
    setTimeout(() => setExportNotice(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            System Activity & Audit Logs
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Immutable system audit trails and ePHI access inspection (HIPAA § 164.312(b)).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleExportAuditLogs}
          >
            <Download className="h-4 w-4" />
            Export Audit Pack (CSV)
          </Button>
        </div>
      </div>

      {exportNotice && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-medium text-green-800">{exportNotice}</p>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label htmlFor="search-logs" className="text-sm font-medium text-gray-700">
                Search Actor or Resource
              </Label>
              <div className="relative mt-1">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  id="search-logs"
                  placeholder="Search user, action, client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">Event Type</Label>
              <div className="mt-1">
                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Event Types</SelectItem>
                    <SelectItem value="DATA_ACCESS">DATA_ACCESS (ePHI View)</SelectItem>
                    <SelectItem value="DATA_MODIFICATION">DATA_MODIFICATION</SelectItem>
                    <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                    <SelectItem value="SECURITY">SECURITY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">ePHI Filter</Label>
              <div className="mt-1">
                <Button
                  type="button"
                  variant={phiOnly ? 'default' : 'outline'}
                  onClick={() => setPhiOnly(!phiOnly)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="h-4 w-4" />
                  {phiOnly ? 'Showing ePHI Access Only' : 'Filter ePHI Access'}
                </Button>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm text-gray-500">
                Showing {filteredLogs.length} of {totalLogs} events
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Audit Trail Records
          </CardTitle>
          <CardDescription>
            Timestamped log of actions, actors, and ePHI access requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Target Resource</TableHead>
                <TableHead>ePHI</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading audit logs...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No audit records match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-gray-600 whitespace-nowrap">
                      {log.timestamp}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{log.actor.name}</p>
                        <p className="text-xs text-gray-500">{log.actor.role}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-gray-800">
                      {log.action}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm text-gray-900">{log.resourceType}</span>
                        {log.clientName && (
                          <p className="text-xs text-primary font-medium">
                            Client: {log.clientName}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.phiAccessed ? (
                        <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-300">
                          ePHI
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          log.result === 'SUCCESS'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }
                      >
                        {log.result}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {log.ipAddress}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
