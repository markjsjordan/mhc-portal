/**
 * Notifications Page
 *
 * All notifications with settings
 */

import React, { useState } from 'react';
import { useUnreadNotifications, useFamilyMemberProfile } from '../hooks';
import { useAuth } from '@/core/hooks';
import { NotificationList, NotificationSettings } from '../components';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import type { UUID } from '@folkcare/core/browser';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const familyMemberId = user?.id as UUID | null;
  const [showSettings, setShowSettings] = useState(false);

  const { data: notifications, isLoading } = useUnreadNotifications(familyMemberId);
  const { data: profile } = useFamilyMemberProfile(familyMemberId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-gray-600">
            Stay updated on important care events and activities
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? 'Hide Settings' : 'Settings'}
        </Button>
      </div>

      {/* Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notifications List */}
        <div className="lg:col-span-2">
          <NotificationList notifications={notifications || []} loading={isLoading} />
        </div>

        {/* Settings Sidebar */}
        {showSettings && profile && (
          <div className="lg:col-span-1">
            <NotificationSettings
              familyMemberId={familyMemberId!}
              currentPreferences={profile.notificationPreferences}
            />
          </div>
        )}
      </div>

      {/* Info Banner */}
      {!showSettings && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 Tip:</strong> Click the Settings button above to customize which
              notifications you receive and how often.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
