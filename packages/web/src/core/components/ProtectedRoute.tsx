/**
 * ProtectedRoute - Route wrapper with authentication and permission checking
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, usePermissions } from '../hooks';
import { getDashboardRoute } from '../utils/role-routing';
import { LoadingSpinner } from './feedback/LoadingSpinner';
import { NoAccess } from './NoAccess';
import type { Role } from '../types/auth';
import type { Section } from '../types/sections';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Required permission to access this route
   */
  permission?: string;
  /**
   * Required permissions (all must be satisfied)
   */
  permissions?: string[];
  /**
   * Required role to access this route
   */
  requiredRole?: Role;
  /**
   * Required roles (at least one must be satisfied)
   */
  requiredRoles?: Role[];
  /**
   * Section for section-based access control
   */
  section?: Section;
  /**
   * Redirect path if permission check fails
   */
  fallbackPath?: string;
}

/**
 * ProtectedRoute component
 * Handles authentication and permission-based access control
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  permissions,
  requiredRole,
  requiredRoles,
  section,
  fallbackPath,
}) => {
  const { isAuthenticated, user, isInitializing } = useAuth();
  const { can, canAll, hasRole, hasAnyRole, canSection } = usePermissions();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to the fallback/dashboard, unless that is where we already are
  // (or the user has no routable dashboard): show NoAccess instead of looping.
  const deny = (): React.ReactElement => {
    const redirect = fallbackPath ?? getDashboardRoute(user.roles);
    if (redirect === location.pathname) {
      return <NoAccess />;
    }
    return <Navigate to={redirect} replace />;
  };

  // Check single permission
  if (permission && !can(permission)) {
    return deny();
  }

  // Check section access (READ access required to view route)
  if (section && !canSection(section, 'READ')) {
    return deny();
  }

  // Check multiple permissions (all required)
  if (permissions && !canAll(permissions)) {
    return deny();
  }

  // Check single required role
  if (requiredRole && !hasRole(requiredRole)) {
    return deny();
  }

  // Check multiple required roles (at least one)
  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return deny();
  }

  // All checks passed
  return <>{children}</>;
};

/**
 * FamilyProtectedRoute - Route wrapper for family portal
 */
export const FamilyProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, user, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect non-family users to their appropriate dashboard
  if (!user.roles.includes('FAMILY') && !user.roles.includes('CLIENT')) {
    const redirect = getDashboardRoute(user.roles);
    if (redirect === location.pathname) {
      return <NoAccess />;
    }
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
};

/**
 * PublicRoute - Route wrapper for public pages (redirects if authenticated)
 */
export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardRoute(user.roles)} replace />;
  }

  return <>{children}</>;
};
