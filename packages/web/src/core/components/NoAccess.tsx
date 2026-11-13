import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks';

/**
 * Shown when a signed-in user has no effective roles/dashboard to land on.
 * Replaces the endless spinner / redirect loop (wdvf3acxk6).
 */
export const NoAccess: React.FC = () => {
  const { user } = useAuth();

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6 text-center"
    >
      <h1 className="text-xl font-semibold text-gray-900">No portal access yet</h1>
      <p className="max-w-md text-gray-600">
        Your account does not have portal access yet. Contact your administrator.
      </p>
      {user?.email ? (
        <p className="text-sm text-gray-500">Signed in as {user.email}</p>
      ) : null}
      <Link
        to="/logout"
        className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
      >
        Logout
      </Link>
    </div>
  );
};
