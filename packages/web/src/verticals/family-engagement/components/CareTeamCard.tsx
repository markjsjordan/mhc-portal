/**
 * Care Team Card Component
 *
 * Display assigned caregivers
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';

interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
  phone?: string;
}

interface CareTeamCardProps {
  careTeam: CareTeamMember[];
}

export const CareTeamCard: React.FC<CareTeamCardProps> = ({ careTeam }) => {
  if (careTeam.length === 0) {
    return (
      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900">Care Team</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <p className="text-sm text-gray-600">No care team members assigned yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Care Team</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-4">
        {careTeam.map((member) => (
          <div key={member.id} className="flex items-center gap-4 rounded-lg bg-gray-50 p-3">
            {member.photoUrl ? (
              <img
                src={member.photoUrl}
                alt={member.name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
                {member.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">{member.name}</h3>
              <p className="text-xs text-gray-600">{member.role}</p>
              {member.phone && (
                <a
                  href={`tel:${member.phone}`}
                  className="text-xs text-primary hover:underline"
                >
                  {member.phone}
                </a>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
