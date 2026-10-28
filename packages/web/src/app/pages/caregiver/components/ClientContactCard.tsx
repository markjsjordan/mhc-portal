/**
 * Client contact card component with tap-to-call functionality
 *
 * Features:
 * - Large touch targets for mobile
 * - Tap-to-call phone numbers
 * - Tap-to-navigate address
 * - Emergency contact display
 */

import React from 'react';
import { useIsMobile } from '@/core/hooks';
import { Card, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import {
  Phone,
  MapPin,
  Navigation,
  AlertCircle,
  Mail,
  User,
} from 'lucide-react';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface ClientContactInfo {
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  address: string;
  emergencyContacts?: EmergencyContact[];
}

interface ClientContactCardProps {
  contact: ClientContactInfo;
  showEmergencyContacts?: boolean;
  className?: string;
}

export const ClientContactCard: React.FC<ClientContactCardProps> = ({
  contact,
  showEmergencyContacts = false,
  className = '',
}) => {
  const isMobile = useIsMobile();

  const formatPhoneForTel = (phone: string): string => {
    return phone.replace(/\D/g, '');
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:+1${formatPhoneForTel(phone)}`;
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const handleNavigate = (address: string) => {
    window.open(
      `https://maps.google.com/?q=${encodeURIComponent(address)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <Card className={cn(className)}>
      <CardContent className="p-6">
        <div className="space-y-4">
        {/* Client Name */}
        <div>
          <h3 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-base'}`}>
            {contact.clientName}
          </h3>
        </div>

        {/* Contact Methods */}
        <div className="space-y-3">
          {/* Phone */}
          {contact.clientPhone && (
            <Button
              variant="outline"
              onClick={() => handleCall(contact.clientPhone!)}
              className={cn(
                'w-full h-auto flex items-center justify-between p-3 text-left font-normal',
                isMobile && 'min-h-[52px]'
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Phone className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4', 'text-primary shrink-0')} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className={cn('font-medium text-foreground', isMobile ? 'text-base' : 'text-sm')}>
                    {contact.clientPhone}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs font-medium text-primary shrink-0">
                TAP TO CALL
              </Badge>
            </Button>
          )}

          {/* Email */}
          {contact.clientEmail && (
            <Button
              variant="outline"
              onClick={() => handleEmail(contact.clientEmail!)}
              className={cn(
                'w-full h-auto flex items-center gap-3 p-3 text-left font-normal justify-start',
                isMobile && 'min-h-[52px]'
              )}
            >
              <Mail className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4', 'text-primary shrink-0')} />
              <div className="flex-1 text-left">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className={cn('font-medium text-foreground', isMobile ? 'text-base' : 'text-sm')}>
                  {contact.clientEmail}
                </p>
              </div>
            </Button>
          )}

          {/* Address */}
          <Button
            variant="outline"
            onClick={() => handleNavigate(contact.address)}
            className={cn(
              'w-full h-auto flex items-start gap-3 p-3 text-left font-normal justify-between',
              isMobile && 'min-h-[52px]'
            )}
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <MapPin className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4', 'text-primary shrink-0 mt-0.5')} />
              <div className="flex-1 text-left">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className={cn('font-medium text-foreground', isMobile ? 'text-base' : 'text-sm')}>
                  {contact.address}
                </p>
              </div>
            </div>
            <Navigation className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4', 'text-muted-foreground shrink-0 mt-0.5')} />
          </Button>
        </div>

        {/* Emergency Contacts */}
        {showEmergencyContacts && contact.emergencyContacts && contact.emergencyContacts.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-red-600`} />
              <h4 className={`font-semibold text-gray-900 ${isMobile ? 'text-base' : 'text-sm'}`}>
                Emergency Contacts
              </h4>
            </div>
            <div className="space-y-2">
              {contact.emergencyContacts.map((emergency, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handleCall(emergency.phone)}
                  className={cn(
                    'w-full h-auto flex items-start gap-3 p-3 text-left font-normal justify-between',
                    isMobile && 'min-h-[52px]'
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <User className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4', 'text-destructive shrink-0 mt-0.5')} />
                    <div className="flex-1 text-left">
                      <p className={cn('font-medium text-foreground', isMobile ? 'text-base' : 'text-sm')}>
                        {emergency.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{emergency.relationship}</p>
                      <p className={cn('font-medium text-destructive mt-1', isMobile ? 'text-sm' : 'text-xs')}>
                        {emergency.phone}
                      </p>
                    </div>
                  </div>
                  <Phone className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4', 'text-destructive shrink-0 mt-0.5')} />
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
      </CardContent>
    </Card>
  );
};
