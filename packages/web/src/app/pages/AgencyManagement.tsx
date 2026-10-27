/**
 * Agency Management Page (Super Admin Only)
 *
 * Allows super admins to view and manage multiple agencies
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert.js';
import { Card } from '@/components/ui/card.js';

interface Organization {
  id: string;
  name: string;
  stateCode: string;
  email: string;
  status: string;
  createdAt: string;
}

export default function AgencyManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/organizations', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to load organizations');
      }
    } catch (err) {
      setError('An error occurred while loading organizations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Agency Management</h1>
        <p className="text-gray-600 mt-2">
          Manage all agencies in the system (Super Admin Only)
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading agencies...</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agency Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    State
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No agencies found
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{org.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{org.stateCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{org.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={org.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {org.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button variant="ghost" size="sm" className="mr-2">
                          View
                        </Button>
                        <Button variant="ghost" size="sm">
                          Settings
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
