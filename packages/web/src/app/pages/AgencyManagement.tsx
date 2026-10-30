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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js';

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                    No agencies found
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="text-sm font-medium text-gray-900">{org.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{org.stateCode}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{org.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" className="mr-2">
                        View
                      </Button>
                      <Button variant="ghost" size="sm">
                        Settings
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
