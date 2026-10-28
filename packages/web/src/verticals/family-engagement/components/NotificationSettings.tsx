/**
 * Notification Settings Component
 *
 * Manage notification preferences
 */

import React, { useState } from 'react';
import type { NotificationPreferences } from '@folkcare/family-engagement';
import { useUpdateNotificationPreferences } from '../hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';

interface NotificationSettingsProps {
  familyMemberId: string;
  currentPreferences: NotificationPreferences;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  familyMemberId,
  currentPreferences,
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(currentPreferences);
  const updatePreferences = useUpdateNotificationPreferences(familyMemberId);

  const handleSave = () => {
    updatePreferences.mutate(preferences, {
      onSuccess: () => {
        alert('Notification preferences updated successfully!');
      },
      onError: (error) => {
        alert('Failed to update preferences. Please try again.');
        console.error(error);
      },
    });
  };

  return (
    <Card>
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-lg font-semibold text-gray-900">Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        {/* Channels */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-gray-900 mb-3">Notification Channels</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="channel-email"
                checked={preferences.emailEnabled}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, emailEnabled: Boolean(checked) })
                }
              />
              <Label htmlFor="channel-email" className="text-sm font-normal text-gray-700 cursor-pointer">
                Email notifications
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="channel-sms"
                checked={preferences.smsEnabled}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, smsEnabled: Boolean(checked) })
                }
              />
              <Label htmlFor="channel-sms" className="text-sm font-normal text-gray-700 cursor-pointer">
                SMS text messages
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="channel-push"
                checked={preferences.pushEnabled}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, pushEnabled: Boolean(checked) })
                }
              />
              <Label htmlFor="channel-push" className="text-sm font-normal text-gray-700 cursor-pointer">
                Push notifications (mobile app)
              </Label>
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-gray-900 mb-3">What to notify me about</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="type-visit-reminders"
                checked={preferences.visitReminders}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, visitReminders: Boolean(checked) })
                }
              />
              <Label htmlFor="type-visit-reminders" className="text-sm font-normal text-gray-700 cursor-pointer">
                Visit reminders
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="type-visit-completed"
                checked={preferences.visitCompletedUpdates}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, visitCompletedUpdates: Boolean(checked) })
                }
              />
              <Label htmlFor="type-visit-completed" className="text-sm font-normal text-gray-700 cursor-pointer">
                Visit completion updates
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="type-careplan-updates"
                checked={preferences.careplanUpdates}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, careplanUpdates: Boolean(checked) })
                }
              />
              <Label htmlFor="type-careplan-updates" className="text-sm font-normal text-gray-700 cursor-pointer">
                Care plan updates
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="type-incident-alerts"
                checked={preferences.incidentAlerts}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, incidentAlerts: Boolean(checked) })
                }
              />
              <Label htmlFor="type-incident-alerts" className="text-sm font-normal text-gray-700 cursor-pointer">
                Incident alerts (important)
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="type-appointment-reminders"
                checked={preferences.appointmentReminders}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, appointmentReminders: Boolean(checked) })
                }
              />
              <Label htmlFor="type-appointment-reminders" className="text-sm font-normal text-gray-700 cursor-pointer">
                Appointment reminders
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="type-message-notifications"
                checked={preferences.messageNotifications}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, messageNotifications: Boolean(checked) })
                }
              />
              <Label htmlFor="type-message-notifications" className="text-sm font-normal text-gray-700 cursor-pointer">
                New messages
              </Label>
            </div>
          </div>
        </div>

        {/* Digest Frequency */}
        <div className="mb-6">
          <Label htmlFor="delivery-frequency" className="block text-sm font-semibold text-gray-900 mb-3">Delivery frequency</Label>
          <Select
            value={preferences.digestFrequency}
            onValueChange={(val) =>
              setPreferences({
                ...preferences,
                digestFrequency: val as NotificationPreferences['digestFrequency'],
              })
            }
          >
            <SelectTrigger id="delivery-frequency" className="w-full">
              <SelectValue placeholder="Select delivery frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IMMEDIATE">Send immediately</SelectItem>
              <SelectItem value="DAILY">Daily digest</SelectItem>
              <SelectItem value="WEEKLY">Weekly digest</SelectItem>
              <SelectItem value="NONE">No notifications</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quiet Hours */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-gray-900 mb-3">Quiet hours (optional)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quiet-hours-start" className="block text-xs text-gray-600 mb-1">From</Label>
              <Input
                id="quiet-hours-start"
                type="time"
                value={preferences.quietHoursStart || ''}
                onChange={(e) =>
                  setPreferences({ ...preferences, quietHoursStart: e.target.value })
                }
                className="w-full text-sm"
              />
            </div>
            <div>
              <Label htmlFor="quiet-hours-end" className="block text-xs text-gray-600 mb-1">To</Label>
              <Input
                id="quiet-hours-end"
                type="time"
                value={preferences.quietHoursEnd || ''}
                onChange={(e) => setPreferences({ ...preferences, quietHoursEnd: e.target.value })}
                className="w-full text-sm"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            During quiet hours, you'll only receive urgent notifications
          </p>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={updatePreferences.isPending}
          className="w-full"
        >
          {updatePreferences.isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
};
