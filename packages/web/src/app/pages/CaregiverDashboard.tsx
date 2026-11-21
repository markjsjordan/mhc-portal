/**
 * Caregiver Dashboard
 *
 * Dashboard for caregivers showing:
 * - Today's schedule with map/directions
 * - Pending tasks by client
 * - Training/credential expiration reminders
 *
 * Error Recovery Features:
 * - Connection status monitoring with visual indicator
 * - Data freshness indicators showing "last updated" timestamps
 * - Manual refresh buttons on each widget
 * - LocalStorage fallback for offline access to last known data
 * - Stale data warnings (>5 minutes old)
 * - Optimistic UI updates for check-in/check-out actions
 *
 * Regulatory Context:
 * - Supports audit requirements by showing data freshness
 * - Critical for EVV compliance when connectivity is intermittent
 * - Offline-first design ensures caregivers can access schedules
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useIsMobile, useApiClient } from '@/core/hooks';
import { useConnectionStatus } from '@/hooks';
import { EmptyState } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { DataFreshness, StaleDataWarning } from '@/components/DataFreshness';
import { NetworkStatusBanner } from '@/components/sync/NetworkStatusBanner';
import {
  getLocalStorage,
  setLocalStorage,
  getLastUpdated,
  CACHE_KEYS,
  CACHE_EXPIRATION,
} from '@/utils/localStorage';
import {
  Calendar,
  Clock,
  MapPin,
  Navigation,
  CheckCircle,
  AlertCircle,
  Award,
  FileText,
  AlertTriangle,
  Users,
  Phone,
  Wifi,
  WifiOff,
} from 'lucide-react';

type VisitStatus = 'upcoming' | 'in-progress' | 'completed';
type CredentialSeverity = 'critical' | 'warning' | 'info';

interface VisitCardProps {
  clientName: string;
  visitType: string;
  time: string;
  duration: string;
  address: string;
  clientPhone?: string;
  status: VisitStatus;
  tasks: string[];
  onNavigate?: () => void;
  onCheckIn?: () => Promise<void>;
  onCheckOut?: () => Promise<void>;
  onViewDetails?: () => void;
  onCall?: () => void;
  isOptimistic?: boolean;
}

const VisitCard: React.FC<VisitCardProps> = ({
  clientName,
  visitType,
  time,
  duration,
  address,
  clientPhone,
  status,
  tasks,
  onNavigate,
  onCheckIn,
  onCheckOut,
  onViewDetails,
  onCall,
  isOptimistic = false,
}) => {
  const isMobile = useIsMobile();
  const [isProcessing, setIsProcessing] = useState(false);

  const getStatusStyles = () => {
    switch (status) {
      case 'upcoming':
        return {
          border: 'border-blue-200',
          bg: 'bg-blue-50',
          badge: 'bg-blue-500',
          text: 'Upcoming',
        };
      case 'in-progress':
        return {
          border: 'border-green-200',
          bg: 'bg-green-50',
          badge: 'bg-green-500',
          text: 'In Progress',
        };
      case 'completed':
        return {
          border: 'border-gray-200',
          bg: 'bg-gray-50',
          badge: 'bg-gray-500',
          text: 'Completed',
        };
    }
  };

  const styles = getStatusStyles();

  const handleCheckIn = async () => {
    if (!onCheckIn || isProcessing) return;
    setIsProcessing(true);
    try {
      await onCheckIn();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!onCheckOut || isProcessing) return;
    setIsProcessing(true);
    try {
      await onCheckOut();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className={`p-6 border-2 ${styles.border} ${styles.bg} ${isOptimistic ? 'opacity-70' : ''}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{clientName}</h3>
              <span className={`px-2 py-0.5 text-xs font-bold text-white rounded ${styles.badge}`}>
                {styles.text}
              </span>
              {isOptimistic && (
                <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-200 rounded">
                  Syncing...
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{visitType}</p>
          </div>
        </div>

        {/* Time and Duration */}
        <div className="flex items-center gap-4 text-sm text-gray-700">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {time}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {duration}
          </div>
        </div>

        {/* Address */}
        {address && (
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{address}</span>
          </div>
        )}

        {/* Client Phone (Mobile) */}
        {clientPhone && isMobile && onCall && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            <Button
              variant="link"
              size="sm"
              onClick={onCall}
              className="h-auto p-0 text-sm font-medium underline"
            >
              {clientPhone}
            </Button>
          </div>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Tasks:</p>
            <ul className="space-y-1">
              {tasks.map((task, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
                  {task}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-wrap'} gap-2 pt-2 border-t border-gray-200`}>
          {onCheckIn && status === 'upcoming' && (
            <Button
              variant="default"
              size={isMobile ? 'lg' : 'sm'}
              onClick={() => void handleCheckIn()}
              disabled={isProcessing}
              className={isMobile ? 'w-full min-h-[44px] text-base font-semibold' : ''}
            >
              <CheckCircle className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              {isProcessing ? 'Checking In...' : 'Check In'}
            </Button>
          )}
          {onCheckOut && status === 'in-progress' && (
            <Button
              variant="default"
              size={isMobile ? 'lg' : 'sm'}
              onClick={() => void handleCheckOut()}
              disabled={isProcessing}
              className={isMobile ? 'w-full min-h-[44px] text-base font-semibold' : ''}
            >
              <CheckCircle className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              {isProcessing ? 'Checking Out...' : 'Check Out'}
            </Button>
          )}
          <div className={`flex ${isMobile ? 'flex-col' : 'flex-wrap'} gap-2 ${isMobile ? 'w-full' : ''}`}>
            {onNavigate && (
              <Button
                variant="outline"
                size={isMobile ? 'lg' : 'sm'}
                onClick={onNavigate}
                className={`flex items-center gap-1 ${isMobile ? 'w-full min-h-[44px]' : ''}`}
              >
                <Navigation className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                Directions
              </Button>
            )}
            {onCall && clientPhone && isMobile && (
              <Button
                variant="outline"
                size="lg"
                onClick={onCall}
                className="w-full min-h-[44px] flex items-center gap-2"
              >
                <Phone className="h-5 w-5" />
                Call Client
              </Button>
            )}
            {onViewDetails && (
              <Button
                variant="outline"
                size={isMobile ? 'lg' : 'sm'}
                onClick={onViewDetails}
                className={isMobile ? 'w-full min-h-[44px]' : ''}
              >
                View Details
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

interface CredentialAlertProps {
  title: string;
  expiresIn: string;
  severity: CredentialSeverity;
  onClick?: () => void;
}

function getExpirationLabel(expiresIn: string): string {
  if (expiresIn === 'Expired') return 'Expired';
  if (expiresIn === 'Today') return 'Expires today';
  return `Expires in ${expiresIn}`;
}

const CredentialAlert: React.FC<CredentialAlertProps> = ({ title, expiresIn, severity, onClick }) => {
  const getSeverityStyles = () => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-600',
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
        };
    }
  };

  const styles = getSeverityStyles();
  const expirationLabel = getExpirationLabel(expiresIn);

  return (
    <div
      className={`p-3 rounded-lg border ${styles.bg} ${styles.border} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className={`h-5 w-5 ${styles.icon} mt-0.5`} />
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
          <p className="text-sm text-gray-600 mt-0.5">{expirationLabel}</p>
        </div>
      </div>
    </div>
  );
};

// Types for dashboard data
interface VisitData {
  id: string;
  evvRecordId?: string;
  clientName: string;
  visitType: string;
  time: string;
  duration: string;
  address: string;
  clientPhone?: string;
  status: VisitStatus;
  tasks: string[];
}

interface CredentialData {
  title: string;
  expiresIn: string;
  severity: CredentialSeverity;
}

interface DashboardStats {
  todayVisitsCount: number;
  todayHoursScheduled: number;
  weekHoursWorked: number;
  activeClientsCount: number;
}

interface ApiVisitAddress {
  line1?: string;
  street1?: string;
  street?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  zipCode?: string;
}

interface ApiVisit {
  id: string;
  evvRecordId?: string;
  clientId?: string;
  clientFirstName?: string;
  clientLastName?: string;
  serviceTypeName?: string;
  visitType?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  scheduledDuration?: number;
  actualDuration?: number;
  billableHours?: number | string;
  address?: ApiVisitAddress | string;
  clientPhone?: string | { number?: string };
  status?: string;
  tasks?: Array<string | { name?: string; title?: string }>;
}

interface ApiTaskItem {
  id?: string;
  visitId?: string;
  clientId?: string;
  name?: string;
  title?: string;
}

interface ApiCredentialItem {
  name?: string;
  title?: string;
  type?: string;
  credentialType?: string;
  expirationDate?: string;
  expiresAt?: string;
  status?: string;
}

interface ApiCaregiverProfile {
  id?: string;
  credentials?: ApiCredentialItem[];
  training?: ApiCredentialItem[];
}

interface ApiEvvRecord {
  id?: string;
  evvRecordId?: string;
  visitId?: string;
  recordStatus?: string;
}

const TIME_PATTERN = /^(\d{1,2}):(\d{2})/;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDateRange(date: Date): { weekStartStr: string; weekEndStr: string } {
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return {
    weekStartStr: formatLocalDate(monday),
    weekEndStr: formatLocalDate(sunday),
  };
}

function parseTimeToMinutes(time?: string): number | null {
  if (!time) return null;
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function formatVisitTime(time?: string): string {
  if (!time) return '';
  const match = TIME_PATTERN.exec(time);
  if (!match) return time;
  const hours24 = Number(match[1]);
  const minutes = match[2];
  if (Number.isNaN(hours24)) return time;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

function getVisitDurationMinutes(visit: ApiVisit): number {
  if (typeof visit.scheduledDuration === 'number' && visit.scheduledDuration > 0) {
    return visit.scheduledDuration;
  }
  const start = parseTimeToMinutes(visit.scheduledStartTime);
  const end = parseTimeToMinutes(visit.scheduledEndTime);
  if (start !== null && end !== null && end > start) {
    return end - start;
  }
  return 0;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

function formatVisitAddress(address?: ApiVisitAddress | string): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  const street = address.line1 ?? address.street1 ?? address.street ?? '';
  const line2 = address.line2 ?? '';
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  const postal = address.postalCode ?? address.zipCode ?? '';
  const cityStateZip = [cityState, postal].filter(Boolean).join(' ');
  return [street, line2, cityStateZip].filter(Boolean).join(', ');
}

function mapVisitStatus(status?: string): VisitStatus {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'IN_PROGRESS':
    case 'ARRIVED':
    case 'PAUSED':
      return 'in-progress';
    default:
      return 'upcoming';
  }
}

function formatExpiresIn(isExpiredStatus: boolean, daysUntilExpiration: number): string {
  if (isExpiredStatus || daysUntilExpiration < 0) return 'Expired';
  if (daysUntilExpiration === 0) return 'Today';
  if (daysUntilExpiration === 1) return '1 day';
  return `${daysUntilExpiration} days`;
}

function mapCredentialsFromProfile(caregiver: ApiCaregiverProfile): CredentialData[] {
  const combinedItems: ApiCredentialItem[] = [
    ...(Array.isArray(caregiver.credentials) ? caregiver.credentials : []),
    ...(Array.isArray(caregiver.training) ? caregiver.training : []),
  ];

  const nowMs = Date.now();
  const liveCredentials: CredentialData[] = [];

  for (const item of combinedItems) {
    const expDateStr = item.expirationDate ?? item.expiresAt;
    const isExpiredStatus = item.status === 'EXPIRED';
    if (!expDateStr && !isExpiredStatus) continue;

    let daysUntilExpiration = -1;
    if (expDateStr) {
      const expMs = new Date(expDateStr).getTime();
      if (Number.isNaN(expMs)) continue;
      daysUntilExpiration = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
    }

    if (!isExpiredStatus && daysUntilExpiration > 90) continue;

    let severity: CredentialSeverity = 'info';
    if (isExpiredStatus || daysUntilExpiration <= 14) {
      severity = 'critical';
    } else if (daysUntilExpiration <= 60) {
      severity = 'warning';
    }

    liveCredentials.push({
      title: item.title ?? item.name ?? item.credentialType ?? item.type ?? 'Credential',
      expiresIn: formatExpiresIn(isExpiredStatus, daysUntilExpiration),
      severity,
    });
  }

  return liveCredentials;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { status?: number; statusCode?: number; response?: { status?: number } };
  return err.status === 404 || err.statusCode === 404 || err.response?.status === 404;
}

function getDeviceInfo(): { userAgent: string } {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  };
}

async function getCurrentGeolocation(): Promise<
  { latitude: number; longitude: number; accuracy: number } | undefined
> {
  const geo =
    typeof navigator !== 'undefined'
      ? (navigator.geolocation as Geolocation | undefined)
      : undefined;
  if (!geo || typeof geo.getCurrentPosition !== 'function') {
    return;
  }
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        // eslint-disable-next-line unicorn/no-useless-undefined -- TypeScript requires explicit undefined for Promise<T | undefined>
        resolve(undefined);
      },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 60000 }
    );
  });
}

export const CaregiverDashboard: React.FC = () => {
  const { user } = useAuth();
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const connectionStatus = useConnectionStatus();

  const [caregiverId, setCaregiverId] = useState<string | null>(null);

  // State for data with localStorage fallback (discard legacy cached mock entries lacking id)
  const [visits, setVisits] = useState<VisitData[]>(() => {
    const cached = getLocalStorage<VisitData[]>(CACHE_KEYS.CAREGIVER_DASHBOARD_VISITS, []);
    return Array.isArray(cached)
      ? cached.filter((v) => typeof v.id === 'string' && v.id.length > 0)
      : [];
  });
  const [credentials, setCredentials] = useState<CredentialData[]>(() =>
    getLocalStorage(CACHE_KEYS.CAREGIVER_DASHBOARD_CREDENTIALS, [])
  );
  const [stats, setStats] = useState<DashboardStats>(() =>
    getLocalStorage(CACHE_KEYS.CAREGIVER_DASHBOARD_STATS, {
      todayVisitsCount: 0,
      todayHoursScheduled: 0,
      weekHoursWorked: 0,
      activeClientsCount: 0,
    })
  );

  // Track refresh state for each widget
  const [isRefreshingVisits, setIsRefreshingVisits] = useState(false);
  const [isRefreshingCredentials, setIsRefreshingCredentials] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);

  // Track last updated times
  const [visitsLastUpdated, setVisitsLastUpdated] = useState<Date | null>(
    () => getLastUpdated(CACHE_KEYS.CAREGIVER_DASHBOARD_VISITS)
  );
  const [credentialsLastUpdated, setCredentialsLastUpdated] = useState<Date | null>(
    () => getLastUpdated(CACHE_KEYS.CAREGIVER_DASHBOARD_CREDENTIALS)
  );
  const [statsLastUpdated, setStatsLastUpdated] = useState<Date | null>(
    () => getLastUpdated(CACHE_KEYS.CAREGIVER_DASHBOARD_STATS)
  );

  // Fetch visits data
  const fetchVisits = useCallback(async () => {
    setIsRefreshingVisits(true);
    try {
      const todayStr = formatLocalDate(new Date());
      const [visitsRes, tasksRes] = await Promise.all([
        apiClient.get<{ success?: boolean; data?: ApiVisit[] }>(
          `/api/visits/my-visits?start_date=${todayStr}&end_date=${todayStr}`
        ),
        apiClient
          .get<{ items?: ApiTaskItem[] }>(
            `/api/tasks?scheduledDateFrom=${todayStr}&scheduledDateTo=${todayStr}`
          )
          .catch(() => ({ items: [] as ApiTaskItem[] })),
      ]);

      const rawVisits = Array.isArray(visitsRes.data) ? visitsRes.data : [];
      const taskItems = Array.isArray(tasksRes.items) ? tasksRes.items : [];

      const liveVisits: VisitData[] = rawVisits
        .filter((v) => v.status !== 'CANCELLED' && v.status !== 'REJECTED')
        .map((visit) => {
          const clientName =
            [visit.clientFirstName, visit.clientLastName].filter(Boolean).join(' ').trim() ||
            'Client';
          const visitType = visit.serviceTypeName ?? visit.visitType ?? 'Care Visit';
          const time = formatVisitTime(visit.scheduledStartTime);
          const duration = formatDuration(getVisitDurationMinutes(visit));
          const address = formatVisitAddress(visit.address);
          const clientPhone =
            typeof visit.clientPhone === 'string'
              ? visit.clientPhone
              : visit.clientPhone?.number;

          const matchedTasks = taskItems
            .filter(
              (task) =>
                task.visitId === visit.id ||
                (!task.visitId && Boolean(visit.clientId) && task.clientId === visit.clientId)
            )
            .map((task) => task.title ?? task.name ?? '')
            .filter(Boolean);

          const embeddedTasks = Array.isArray(visit.tasks)
            ? visit.tasks
                .map((t) => (typeof t === 'string' ? t : t.title ?? t.name ?? ''))
                .filter(Boolean)
            : [];

          return {
            id: visit.id,
            evvRecordId: visit.evvRecordId,
            clientName,
            visitType,
            time,
            duration,
            address,
            clientPhone,
            status: mapVisitStatus(visit.status),
            tasks: matchedTasks.length > 0 ? matchedTasks : embeddedTasks,
          };
        });

      setVisits(liveVisits);
      setLocalStorage(
        CACHE_KEYS.CAREGIVER_DASHBOARD_VISITS,
        liveVisits,
        CACHE_EXPIRATION.FIFTEEN_MINUTES
      );
      setVisitsLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching visits:', error);
      // Keep using cached data
    } finally {
      setIsRefreshingVisits(false);
    }
  }, [apiClient]);

  // Fetch credentials data
  const fetchCredentials = useCallback(async () => {
    setIsRefreshingCredentials(true);
    try {
      const caregiver = await apiClient.get<ApiCaregiverProfile>('/api/caregivers/me');
      if (caregiver.id) {
        setCaregiverId(caregiver.id);
      }

      const liveCredentials = mapCredentialsFromProfile(caregiver);

      setCredentials(liveCredentials);
      setLocalStorage(
        CACHE_KEYS.CAREGIVER_DASHBOARD_CREDENTIALS,
        liveCredentials,
        CACHE_EXPIRATION.ONE_HOUR
      );
      setCredentialsLastUpdated(new Date());
    } catch (error) {
      if (isNotFoundError(error)) {
        setCredentials([]);
        setLocalStorage(
          CACHE_KEYS.CAREGIVER_DASHBOARD_CREDENTIALS,
          [],
          CACHE_EXPIRATION.ONE_HOUR
        );
        setCredentialsLastUpdated(new Date());
      } else {
        console.error('Error fetching credentials:', error);
      }
    } finally {
      setIsRefreshingCredentials(false);
    }
  }, [apiClient]);

  // Fetch stats data
  const fetchStats = useCallback(async () => {
    setIsRefreshingStats(true);
    try {
      const now = new Date();
      const todayStr = formatLocalDate(now);
      const { weekStartStr, weekEndStr } = getWeekDateRange(now);

      const response = await apiClient.get<{ success?: boolean; data?: ApiVisit[] }>(
        `/api/visits/my-visits?start_date=${weekStartStr}&end_date=${weekEndStr}`
      );
      const rawVisits = Array.isArray(response.data) ? response.data : [];
      const activeVisits = rawVisits.filter(
        (v) => v.status !== 'CANCELLED' && v.status !== 'REJECTED'
      );

      const todayVisits = activeVisits.filter(
        (v) => String(v.scheduledDate ?? '').slice(0, 10) === todayStr
      );

      const todayMinutes = todayVisits.reduce(
        (sum, v) => sum + getVisitDurationMinutes(v),
        0
      );
      const todayHoursScheduled = Math.round((todayMinutes / 60) * 10) / 10;

      const weekHoursRaw = activeVisits.reduce((sum, v) => {
        if (typeof v.actualDuration === 'number' && v.actualDuration > 0) {
          return sum + v.actualDuration / 60;
        }
        if (v.billableHours !== undefined && Number(v.billableHours) > 0) {
          return sum + Number(v.billableHours);
        }
        if (v.status === 'COMPLETED') {
          return sum + getVisitDurationMinutes(v) / 60;
        }
        return sum;
      }, 0);
      const weekHoursWorked = Math.round(weekHoursRaw * 10) / 10;

      const activeClientsCount = new Set(
        activeVisits.map((v) => v.clientId).filter(Boolean)
      ).size;

      const liveStats: DashboardStats = {
        todayVisitsCount: todayVisits.length,
        todayHoursScheduled,
        weekHoursWorked,
        activeClientsCount,
      };

      setStats(liveStats);
      setLocalStorage(
        CACHE_KEYS.CAREGIVER_DASHBOARD_STATS,
        liveStats,
        CACHE_EXPIRATION.FIFTEEN_MINUTES
      );
      setStatsLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsRefreshingStats(false);
    }
  }, [apiClient]);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchVisits(),
      fetchCredentials(),
      fetchStats(),
    ]);
  }, [fetchVisits, fetchCredentials, fetchStats]);

  // Navigation handlers to avoid void operator issues
  const handleNavigateToCredentials = useCallback(() => {
    Promise.resolve(navigate('/settings/profile')).catch(() => {});
  }, [navigate]);

  const handleNavigateToSchedule = useCallback(() => {
    Promise.resolve(navigate('/scheduling')).catch(() => {});
  }, [navigate]);

  const handleNavigateToMyWeeklySchedule = useCallback(() => {
    Promise.resolve(navigate('/caregiver/schedule')).catch(() => {});
  }, [navigate]);

  const handleNavigateToTraining = useCallback(() => {
    const targetId = caregiverId ?? user?.id;
    if (targetId) {
      Promise.resolve(navigate(`/caregivers/${targetId}/training`)).catch(() => {});
    }
  }, [navigate, caregiverId, user?.id]);

  // Initial data load
  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Optimistic UI for check-in/check-out
  const handleCheckIn = async (visitIndex: number) => {
    const visit = visits[visitIndex];
    if (!visit) return;

    // Optimistically update UI
    const updatedVisits = [...visits];
    if (updatedVisits[visitIndex]) {
      updatedVisits[visitIndex] = { ...updatedVisits[visitIndex]!, status: 'in-progress' };
      setVisits(updatedVisits);
    }

    try {
      const location = await getCurrentGeolocation();
      const response = await apiClient.post<{
        evvRecordId?: string;
        id?: string;
        data?: { evvRecordId?: string; id?: string };
      }>('/api/evv/clock-in', {
        visitId: visit.id,
        caregiverId: caregiverId ?? user?.id,
        location,
        deviceInfo: getDeviceInfo(),
      });

      const returnedEvvId =
        response.evvRecordId ?? response.id ?? response.data?.evvRecordId ?? response.data?.id;

      const syncedVisits = updatedVisits.map((item, idx) =>
        idx === visitIndex && returnedEvvId ? { ...item, evvRecordId: returnedEvvId } : item
      );
      setVisits(syncedVisits);
      setLocalStorage(
        CACHE_KEYS.CAREGIVER_DASHBOARD_VISITS,
        syncedVisits,
        CACHE_EXPIRATION.FIFTEEN_MINUTES
      );
      setVisitsLastUpdated(new Date());
      void fetchStats();
    } catch (error) {
      console.error('Error checking in:', error);
      // Revert on error
      await fetchVisits();
    }
  };

  const handleCheckOut = async (visitIndex: number) => {
    const visit = visits[visitIndex];
    if (!visit) return;

    // Optimistically update UI
    const updatedVisits = [...visits];
    if (updatedVisits[visitIndex]) {
      updatedVisits[visitIndex] = { ...updatedVisits[visitIndex]!, status: 'completed' };
      setVisits(updatedVisits);
    }

    try {
      let evvRecordId = visit.evvRecordId;
      const resolvedCaregiverId = caregiverId ?? user?.id;

      if (!evvRecordId && resolvedCaregiverId) {
        const evvRes = await apiClient.get<{ data?: ApiEvvRecord[]; records?: ApiEvvRecord[] }>(
          `/api/evv?caregiverId=${resolvedCaregiverId}`
        );
        let records: ApiEvvRecord[] = [];
        if (Array.isArray(evvRes.data)) {
          records = evvRes.data;
        } else if (Array.isArray(evvRes.records)) {
          records = evvRes.records;
        }
        const pending = records.find(
          (r) => r.visitId === visit.id && r.recordStatus === 'PENDING'
        );
        evvRecordId = pending?.evvRecordId ?? pending?.id;
      }

      if (!evvRecordId) {
        throw new Error('Missing EVV record ID for clock-out');
      }

      const location = await getCurrentGeolocation();
      await apiClient.post(`/api/evv/${evvRecordId}/clock-out`, {
        visitId: visit.id,
        caregiverId: resolvedCaregiverId,
        location,
        deviceInfo: getDeviceInfo(),
      });

      setLocalStorage(
        CACHE_KEYS.CAREGIVER_DASHBOARD_VISITS,
        updatedVisits,
        CACHE_EXPIRATION.FIFTEEN_MINUTES
      );
      setVisitsLastUpdated(new Date());
      void fetchStats();
    } catch (error) {
      console.error('Error checking out:', error);
      // Revert on error
      await fetchVisits();
    }
  };

  return (
    <div className="space-y-6">
      {/* Network Status Banner */}
      <NetworkStatusBanner />

      {/* Connection Status Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.name ? user.name.split(' ')[0] : 'Caregiver'}!
          </h1>
          <p className="mt-1 text-gray-600">
            Here's your schedule for today
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {connectionStatus.isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-medium">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-600" />
              <span className="text-amber-700 font-medium">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Stale Data Warning */}
      <StaleDataWarning
        lastUpdated={statsLastUpdated}
        onRefresh={async () => refreshAll()}
        isRefreshing={isRefreshingStats}
      />

      {/* Quick Stats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
          <DataFreshness
            lastUpdated={statsLastUpdated}
            onRefresh={async () => fetchStats()}
            isRefreshing={isRefreshingStats}
            compact
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Visits</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.todayVisitsCount}</p>
                <p className="mt-1 text-sm text-gray-600">{stats.todayHoursScheduled} hours scheduled</p>
              </div>
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.weekHoursWorked}</p>
                <p className="mt-1 text-sm text-gray-600">hours worked</p>
              </div>
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Clients</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.activeClientsCount}</p>
                <p className="mt-1 text-sm text-gray-600">on your schedule</p>
              </div>
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </Card>
        </div>
      </div>

      {/* Credential Alerts */}
      {credentials.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`${isMobile ? 'h-6 w-6' : 'h-5 w-5'} text-yellow-600`} />
              <h2 className={`${isMobile ? 'text-xl' : 'text-lg'} font-semibold text-gray-900`}>
                Training & Credential Reminders
              </h2>
            </div>
            <DataFreshness
              lastUpdated={credentialsLastUpdated}
              onRefresh={async () => fetchCredentials()}
              isRefreshing={isRefreshingCredentials}
              compact
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {credentials.map((credential, index) => (
              <CredentialAlert
                key={index}
                {...credential}
                onClick={handleNavigateToCredentials}
              />
            ))}
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className={`${isMobile ? 'text-xl' : 'text-lg'} font-semibold text-gray-900`}>Today's Schedule</h2>
          </div>
          <div className="flex items-center gap-3">
            <DataFreshness
              lastUpdated={visitsLastUpdated}
              onRefresh={async () => fetchVisits()}
              isRefreshing={isRefreshingVisits}
              compact
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateToSchedule}
            >
              View Full Schedule
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {visits.length > 0 ? (
            visits.map((visit, index) => (
              <VisitCard
                key={visit.id}
                {...visit}
                onNavigate={
                  visit.address
                    ? () =>
                        window.open(
                          `https://maps.google.com/?q=${encodeURIComponent(visit.address)}`,
                          '_blank',
                          'noopener,noreferrer'
                        )
                    : undefined
                }
                onCheckIn={async () => handleCheckIn(index)}
                onCheckOut={async () => handleCheckOut(index)}
                onViewDetails={() => {
                  Promise.resolve(navigate(`/visits/${visit.id}`)).catch(() => {});
                }}
                onCall={
                  visit.clientPhone
                    ? () => {
                        window.location.href = `tel:${visit.clientPhone ?? ''}`;
                      }
                    : undefined
                }
              />
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  title="No visits scheduled today"
                  description="Enjoy your day off! Check back tomorrow for your schedule."
                  icon={<Calendar className="h-12 w-12" />}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="justify-start"
              onClick={handleNavigateToSchedule}
            >
              <Calendar className="h-5 w-5 mr-2" />
              View Schedule
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={handleNavigateToMyWeeklySchedule}
            >
              <Calendar className="h-5 w-5 mr-2" />
              My Schedule
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={handleNavigateToCredentials}
            >
              <Award className="h-5 w-5 mr-2" />
              Update Credentials
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={handleNavigateToTraining}
            >
              <FileText className="h-5 w-5 mr-2" />
              Training Materials
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
