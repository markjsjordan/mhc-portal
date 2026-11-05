import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card.js';
import { StatusBadge, DemoBadge } from '@/core/components';
import { formatDate, formatPhone } from '@/core/utils';
import type { Client } from '../types';

export interface ClientCardProps {
  client: Client;
  compact?: boolean;
}

export const ClientCard: React.FC<ClientCardProps> = ({ client, compact = false }) => {
  const fullName = [client.firstName, client.middleName, client.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <Link to={`/clients/${client.id}`}>
      <Card className="h-full hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {client.preferredName ?? fullName}
            </h3>
            <p className="text-sm text-gray-600 truncate">{client.clientNumber}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {client.isDemoData && <DemoBadge />}
            <StatusBadge status={client.status} />
          </div>
        </div>

        {!compact && (
          <div className="mt-4 space-y-2">
            {client.primaryPhone && (
              <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{formatPhone(client.primaryPhone.number)}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
            {(client.primaryAddress.city || client.primaryAddress.state) && (
              <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {client.primaryAddress.city}, {client.primaryAddress.state}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">DOB: {formatDate(client.dateOfBirth)}</span>
            </div>
          </div>
        )}
        </CardContent>
      </Card>
    </Link>
  );
};
