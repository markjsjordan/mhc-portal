import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks';
import { getDashboardRoute } from '@/core/utils';
import { NoAccess } from '@/core/components/NoAccess';

/**
 * Smart component that redirects to the appropriate dashboard based on user role
 * This component should only be rendered at the root path "/"
 *
 * Users with no routable dashboard (e.g. empty effective roles) get a NoAccess
 * panel instead of navigating to "/" from "/" and spinning forever.
 */
export const DashboardSelector: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const dashboardRoute = user ? getDashboardRoute(user.roles) : null;
  const hasNoAccess = user !== null && dashboardRoute === '/';

  useEffect(() => {
    if (dashboardRoute !== null && dashboardRoute !== '/') {
      // Only redirect if not already at root
      if (window.location.pathname === '/') {
        Promise.resolve(navigate(dashboardRoute, { replace: true })).catch(() => {});
      }
    }
  }, [dashboardRoute, navigate]);

  if (hasNoAccess) {
    return <NoAccess />;
  }

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
};
