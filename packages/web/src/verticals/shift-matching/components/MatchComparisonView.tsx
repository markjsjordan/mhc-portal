/**
 * Match Comparison View
 * 
 * Side-by-side comparison of 2-4 caregiver candidates:
 * - Compare scores across all dimensions
 * - Highlight differences
 * - Visual diff indicators
 * - Select winner from comparison
 */

import React, { useState } from 'react';
import { X, Download, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table.js';
import type { MatchCandidate } from '../types';
import { getMatchScoreColor, formatDistance } from '../utils';

interface MatchComparisonViewProps {
  candidates: MatchCandidate[];
  maxCandidates?: number;
  onSelect?: (caregiverId: string) => void;
  onClose?: () => void;
}

export const MatchComparisonView: React.FC<MatchComparisonViewProps> = ({
  candidates: allCandidates,
  maxCandidates = 4,
  onSelect,
  onClose,
}) => {
  const [selectedCandidates, setSelectedCandidates] = useState<MatchCandidate[]>(
    allCandidates.slice(0, Math.min(maxCandidates, allCandidates.length))
  );

  const handleRemoveCandidate = (caregiverId: string) => {
    setSelectedCandidates(prev => prev.filter(c => c.caregiverId !== caregiverId));
  };

  const handleAddCandidate = (candidate: MatchCandidate) => {
    if (selectedCandidates.length < maxCandidates) {
      setSelectedCandidates(prev => [...prev, candidate]);
    }
  };

  const availableCandidates = allCandidates.filter(
    c => !selectedCandidates.find(sc => sc.caregiverId === c.caregiverId)
  );

  const getMedal = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return null;
  };

  // Find highest/lowest scores for highlighting
  const getValueClass = (value: number, allValues: number[]) => {
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    if (value === max && max !== min) return 'font-bold text-green-700 bg-green-50';
    if (value === min && max !== min) return 'text-red-600';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Compare Candidates</h2>
          <p className="text-sm text-gray-600 mt-1">
            Comparing {selectedCandidates.length} of {allCandidates.length} candidates
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Export comparison as PDF/CSV
              console.log('Export comparison');
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Add more candidates */}
      {availableCandidates.length > 0 && selectedCandidates.length < maxCandidates && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Add More Candidates</h3>
          <div className="flex gap-2 flex-wrap">
            {availableCandidates.slice(0, 5).map(candidate => (
              <Button
                key={candidate.caregiverId}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddCandidate(candidate)}
              >
                {candidate.caregiverName} ({candidate.overallScore})
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Metric</TableHead>
                {selectedCandidates.map((candidate, index) => (
                  <TableHead
                    key={candidate.caregiverId}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getMedal(index) && <span>{getMedal(index)}</span>}
                        <span>Candidate {index + 1}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveCandidate(candidate.caregiverId)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remove candidate"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Name */}
              <TableRow className="bg-muted/50">
                <TableCell className="font-medium">
                  Name
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className="font-semibold">
                    {candidate.caregiverName}
                  </TableCell>
                ))}
              </TableRow>

              {/* Overall Score */}
              <TableRow>
                <TableCell className="font-medium">
                  Overall Score
                </TableCell>
                {selectedCandidates.map(candidate => {
                  const scoreColor = getMatchScoreColor(candidate.overallScore);
                  return (
                    <TableCell key={candidate.caregiverId} className={getValueClass(candidate.overallScore, selectedCandidates.map(c => c.overallScore))}>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${scoreColor}`}>
                          {candidate.overallScore}
                        </span>
                        <span className="text-sm text-gray-500">/ 100</span>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* Skills */}
              <TableRow className="bg-muted/50">
                <TableCell className="text-gray-700">
                  Skills Match
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className={getValueClass(candidate.scores.skillMatch, selectedCandidates.map(c => c.scores.skillMatch))}>
                    {candidate.scores.skillMatch}
                  </TableCell>
                ))}
              </TableRow>

              {/* Availability */}
              <TableRow>
                <TableCell className="text-gray-700">
                  Availability
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className={getValueClass(candidate.scores.availabilityMatch, selectedCandidates.map(c => c.scores.availabilityMatch))}>
                    <div className="flex items-center gap-2">
                      {candidate.scores.availabilityMatch}
                      {candidate.hasConflict && (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </TableCell>
                ))}
              </TableRow>

              {/* Distance */}
              <TableRow className="bg-muted/50">
                <TableCell className="text-gray-700">
                  Location (Distance)
                </TableCell>
                {selectedCandidates.map(candidate => {
                  const distances = selectedCandidates
                    .filter(c => c.distanceFromShift !== undefined)
                    .map(c => c.distanceFromShift!);
                  return (
                    <TableCell key={candidate.caregiverId} className={candidate.distanceFromShift !== undefined ? getValueClass(-candidate.distanceFromShift, distances.map(d => -d)) : ''}>
                      {candidate.distanceFromShift !== undefined
                        ? formatDistance(candidate.distanceFromShift)
                        : 'N/A'}
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* Proximity Score */}
              <TableRow>
                <TableCell className="text-gray-700">
                  Proximity Score
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className={getValueClass(candidate.scores.proximityMatch, selectedCandidates.map(c => c.scores.proximityMatch))}>
                    {candidate.scores.proximityMatch}
                  </TableCell>
                ))}
              </TableRow>

              {/* Experience */}
              <TableRow className="bg-muted/50">
                <TableCell className="text-gray-700">
                  Experience
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className={getValueClass(candidate.scores.experienceMatch, selectedCandidates.map(c => c.scores.experienceMatch))}>
                    {candidate.scores.experienceMatch}
                  </TableCell>
                ))}
              </TableRow>

              {/* Previous Visits */}
              <TableRow>
                <TableCell className="text-gray-700">
                  Previous Visits
                </TableCell>
                {selectedCandidates.map(candidate => {
                  const visits = selectedCandidates
                    .filter(c => c.previousVisitsWithClient !== undefined)
                    .map(c => c.previousVisitsWithClient!);
                  return (
                    <TableCell key={candidate.caregiverId} className={candidate.previousVisitsWithClient !== undefined ? getValueClass(candidate.previousVisitsWithClient, visits) : ''}>
                      {candidate.previousVisitsWithClient ?? 0}
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* Client Rating */}
              <TableRow className="bg-muted/50">
                <TableCell className="text-gray-700">
                  Client Rating
                </TableCell>
                {selectedCandidates.map(candidate => {
                  const ratings = selectedCandidates
                    .filter(c => c.clientRating !== undefined)
                    .map(c => c.clientRating!);
                  return (
                    <TableCell key={candidate.caregiverId} className={candidate.clientRating !== undefined ? getValueClass(candidate.clientRating, ratings) : ''}>
                      {candidate.clientRating !== undefined
                        ? `${candidate.clientRating.toFixed(1)} ⭐`
                        : 'N/A'}
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* Reliability */}
              <TableRow>
                <TableCell className="text-gray-700">
                  Reliability
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className={getValueClass(candidate.scores.reliabilityMatch, selectedCandidates.map(c => c.scores.reliabilityMatch))}>
                    {candidate.scores.reliabilityMatch}
                  </TableCell>
                ))}
              </TableRow>

              {/* Compliance */}
              <TableRow className="bg-muted/50">
                <TableCell className="text-gray-700">
                  Compliance
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className={getValueClass(candidate.scores.complianceMatch, selectedCandidates.map(c => c.scores.complianceMatch))}>
                    {candidate.scores.complianceMatch}
                  </TableCell>
                ))}
              </TableRow>

              {/* Employment Type */}
              <TableRow>
                <TableCell className="text-gray-700">
                  Employment
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className="text-gray-600">
                    {candidate.employmentType}
                  </TableCell>
                ))}
              </TableRow>

              {/* Eligibility */}
              <TableRow className="bg-muted/50">
                <TableCell className="text-gray-700">
                  Eligible
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId}>
                    {candidate.isEligible ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" />
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <X className="h-3 w-3 mr-1" />
                        No
                      </span>
                    )}
                  </TableCell>
                ))}
              </TableRow>

              {/* Issues */}
              <TableRow>
                <TableCell className="text-gray-700">
                  Issues
                </TableCell>
                {selectedCandidates.map(candidate => (
                  <TableCell key={candidate.caregiverId} className="text-gray-600">
                    {candidate.eligibilityIssues.length === 0 ? (
                      <span className="text-gray-400">None</span>
                    ) : (
                      <ul className="text-xs space-y-1">
                        {candidate.eligibilityIssues.slice(0, 2).map((issue, idx) => (
                          <li key={idx} className={issue.severity === 'BLOCKING' ? 'text-red-600' : 'text-yellow-600'}>
                            • {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                ))}
              </TableRow>

              {/* Action Row */}
              {onSelect && (
                <TableRow className="bg-muted">
                  <TableCell className="font-medium">
                    Select Candidate
                  </TableCell>
                  {selectedCandidates.map(candidate => (
                    <TableCell key={candidate.caregiverId}>
                      <Button
                        onClick={() => onSelect(candidate.caregiverId)}
                        variant={candidate.isEligible ? 'default' : 'outline'}
                        disabled={!candidate.isEligible}
                        size="sm"
                        className="w-full"
                      >
                        {candidate.isEligible ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Select
                          </>
                        ) : (
                          'Ineligible'
                        )}
                      </Button>
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Legend</h3>
        <div className="flex gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
            <span>Highest value</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border border-gray-200 rounded"></div>
            <span>Middle value</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-600">Red text</span>
            <span>Lowest value</span>
          </div>
        </div>
      </div>
    </div>
  );
};
