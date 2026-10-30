/**
 * Top Performers Table Component
 * Displays top caregivers by performance metrics
 */

import { Award, TrendingUp } from 'lucide-react';
import type { CaregiverPerformance } from '@/types/analytics-types';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js';

interface TopPerformersTableProps {
  caregivers: CaregiverPerformance[];
  limit?: number;
  className?: string;
  onCaregiverClick?: (caregiverId: string) => void;
}

const getEvvBadgeClass = (rate: number) => {
  if (rate >= 95) return 'bg-green-50 text-green-700 border-green-200';
  if (rate >= 85) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
};

export function TopPerformersTable({
  caregivers,
  limit = 5,
  className = '',
  onCaregiverClick,
}: Readonly<TopPerformersTableProps>) {
  // Sort by performance score and take top N
  const topPerformers = [...caregivers]
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, limit);

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Caregiver</TableHead>
            <TableHead>Visits</TableHead>
            <TableHead>On-Time %</TableHead>
            <TableHead>EVV Compliance</TableHead>
            <TableHead>Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topPerformers.map((caregiver, index) => (
            <TableRow
              key={caregiver.caregiverId}
              className={onCaregiverClick ? 'cursor-pointer' : ''}
              onClick={() =>
                onCaregiverClick?.(caregiver.caregiverId)
              }
            >
              <TableCell>
                <div className="flex items-center">
                  {index === 0 && (
                    <Award className="h-5 w-5 text-yellow-500 mr-1" />
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {index + 1}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium text-gray-900">
                  {caregiver.caregiverName}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-gray-900">
                  {caregiver.visitsCompleted}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  <span className="text-sm text-gray-900">
                    {caregiver.onTimePercentage.toFixed(1)}%
                  </span>
                  {caregiver.onTimePercentage >= 95 && (
                    <TrendingUp className="h-4 w-4 text-green-500 ml-1" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={getEvvBadgeClass(caregiver.evvComplianceRate)}
                >
                  {caregiver.evvComplianceRate.toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  <div className="text-sm font-bold text-primary-600">
                    {caregiver.performanceScore.toFixed(0)}
                  </div>
                  <div className="ml-2 text-xs text-gray-500">/100</div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {topPerformers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No performance data available
        </div>
      )}
    </div>
  );
}
