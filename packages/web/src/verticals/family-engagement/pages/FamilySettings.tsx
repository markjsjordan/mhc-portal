/**
 * Family Settings Page
 *
 * Comprehensive settings page for family members to manage their portal
 * preferences, notification settings, and profile information.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useFamilyMemberProfile } from '../hooks';
import { useAuth } from '@/core/hooks';
import { NotificationSettings } from '../components/NotificationSettings';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import type { FamilyMember, FamilyRelationship } from '@folkcare/family-engagement';
import type { UUID } from '@folkcare/core/browser';

export const FamilySettings: React.FC = () => {
  const { user } = useAuth();
  const familyMemberId = user?.id as UUID | null;
  const { data: familyMember, isLoading, error } = useFamilyMemberProfile(familyMemberId);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'data'>('profile');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error || !familyMember) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Unable to load settings</h2>
          <p className="text-sm text-gray-600">
            {error instanceof Error ? error.message : 'Please try again later'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your profile, notification preferences, and data export options
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Settings">
          <button
            onClick={() => setActiveTab('profile')}
            className={`${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
          >
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`${
              activeTab === 'notifications'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`${
              activeTab === 'data'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
          >
            Data & Privacy
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'profile' && <ProfileTab familyMember={familyMember} />}
        {activeTab === 'notifications' && (
          <NotificationSettings
            familyMemberId={familyMember.id}
            currentPreferences={familyMember.notificationPreferences}
          />
        )}
        {activeTab === 'data' && <DataTab familyMember={familyMember} />}
      </div>
    </div>
  );
};

/**
 * Profile Information Tab
 */
const ProfileTab: React.FC<{ familyMember: FamilyMember }> = ({ familyMember }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: familyMember.firstName,
    lastName: familyMember.lastName,
    email: familyMember.email,
    phoneNumber: familyMember.phoneNumber,
    preferredContactMethod: familyMember.preferredContactMethod,
    relationship: familyMember.relationship,
    relationshipNote: familyMember.relationshipNote || '',
  });

  const handleSave = () => {
    // No backend endpoint exists yet to persist family member profile edits
    // (family-portal-api.ts only supports notification preference updates).
    // Honest no-op stub until that endpoint is built — do not pretend success.
    toast.error('Profile editing is not yet available');
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-6">
        <CardTitle className="text-lg font-semibold text-gray-900">Personal Information</CardTitle>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1">First Name</Label>
            {isEditing ? (
              <Input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full text-sm"
              />
            ) : (
              <p className="text-sm text-gray-900">{familyMember.firstName}</p>
            )}
          </div>
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1">Last Name</Label>
            {isEditing ? (
              <Input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full text-sm"
              />
            ) : (
              <p className="text-sm text-gray-900">{familyMember.lastName}</p>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">Email</Label>
          {isEditing ? (
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full text-sm"
            />
          ) : (
            <p className="text-sm text-gray-900">{familyMember.email}</p>
          )}
        </div>

        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</Label>
          {isEditing ? (
            <Input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full text-sm"
            />
          ) : (
            <p className="text-sm text-gray-900">{familyMember.phoneNumber}</p>
          )}
        </div>

        {/* Preferred Contact Method */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">
            Preferred Contact Method
          </Label>
          {isEditing ? (
            <select
              value={formData.preferredContactMethod}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferredContactMethod: e.target.value as FamilyMember['preferredContactMethod'],
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 bg-background"
            >
              <option value="EMAIL">Email</option>
              <option value="PHONE">Phone Call</option>
              <option value="SMS">Text Message (SMS)</option>
              <option value="PORTAL">Portal Only</option>
            </select>
          ) : (
            <p className="text-sm text-gray-900 capitalize">
              {familyMember.preferredContactMethod.replace('_', ' ').toLowerCase()}
            </p>
          )}
        </div>

        {/* Relationship */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">
            Relationship to Care Recipient
          </Label>
          {isEditing ? (
            <select
              value={formData.relationship}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  relationship: e.target.value as FamilyRelationship,
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 bg-background"
            >
              <option value="SPOUSE">Spouse</option>
              <option value="PARENT">Parent</option>
              <option value="CHILD">Child</option>
              <option value="SIBLING">Sibling</option>
              <option value="GRANDPARENT">Grandparent</option>
              <option value="GRANDCHILD">Grandchild</option>
              <option value="GUARDIAN">Legal Guardian</option>
              <option value="POWER_OF_ATTORNEY">Power of Attorney</option>
              <option value="HEALTHCARE_PROXY">Healthcare Proxy</option>
              <option value="OTHER">Other</option>
            </select>
          ) : (
            <p className="text-sm text-gray-900 capitalize">
              {familyMember.relationship.replace(/_/g, ' ').toLowerCase()}
            </p>
          )}
        </div>

        {/* Relationship Note */}
        {(isEditing || familyMember.relationshipNote) && (
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1">
              Relationship Details (Optional)
            </Label>
            {isEditing ? (
              <Textarea
                value={formData.relationshipNote}
                onChange={(e) => setFormData({ ...formData, relationshipNote: e.target.value })}
                rows={2}
                className="w-full text-sm"
                placeholder="e.g., Primary caregiver, lives nearby"
              />
            ) : (
              <p className="text-sm text-gray-700">{familyMember.relationshipNote}</p>
            )}
          </div>
        )}

        {/* Access Level (read-only) */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">Portal Access Level</Label>
          <p className="text-sm text-gray-900 capitalize">
            {familyMember.portalAccessLevel.replace(/_/g, ' ').toLowerCase()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Contact your care coordinator to change your access level
          </p>
        </div>

        {/* Edit Mode Actions */}
        {isEditing && (
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleSave}
              className="flex-1"
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFormData({
                  firstName: familyMember.firstName,
                  lastName: familyMember.lastName,
                  email: familyMember.email,
                  phoneNumber: familyMember.phoneNumber,
                  preferredContactMethod: familyMember.preferredContactMethod,
                  relationship: familyMember.relationship,
                  relationshipNote: familyMember.relationshipNote || '',
                });
                setIsEditing(false);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Data & Privacy Tab
 */
const DataTab: React.FC<{ familyMember: FamilyMember }> = ({ familyMember }) => {
  const handleExportData = () => {
    alert('Data export functionality will download your data in JSON format');
    console.log('Exporting data for:', familyMember.id);
  };

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900">Export Your Data</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <p className="text-sm text-gray-600 mb-4">
            Download all your portal data, including notification history, messages, and activity logs.
            Data will be provided in JSON format.
          </p>
          <Button
            onClick={handleExportData}
          >
            Export My Data
          </Button>
        </CardContent>
      </Card>

      {/* Privacy Information */}
      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900">Privacy & Security</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">Last Login</h3>
              <p className="text-gray-600">
                {familyMember.lastLoginAt
                  ? new Date(familyMember.lastLoginAt).toLocaleString()
                  : 'Never logged in'}
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-1">Portal Status</h3>
              <p className="text-gray-600 capitalize">{familyMember.status.toLowerCase()}</p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-1">Access Granted</h3>
              <p className="text-gray-600">
                {new Date(familyMember.accessGrantedAt).toLocaleDateString()}
              </p>
            </div>

            {familyMember.accessExpiresAt && (
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Access Expires</h3>
                <p className="text-gray-600">
                  {new Date(familyMember.accessExpiresAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-semibold text-destructive">Deactivate Portal Access</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <p className="text-sm text-destructive/80 mb-4">
            If you no longer need portal access, you can request deactivation. This action requires
            confirmation from your care coordinator.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              alert('Portal deactivation requires coordinator approval. Please contact your care team.')
            }
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            Request Deactivation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
