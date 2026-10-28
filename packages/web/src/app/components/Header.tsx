import React from 'react';
import { Menu, Bell, User, Shield } from 'lucide-react';
import { useAuth } from '@/core/hooks';
import { Button } from '@/components/ui/button.js';
import mqtLogo from '@/assets/mqt-logo.png';
import { getPrimaryRole, getRoleLabel } from '@/core/utils/role-routing';

export interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();

  const primaryRole = user ? getPrimaryRole(user.roles) : null;
  const roleLabel = primaryRole ? getRoleLabel(primaryRole) : 'User';

  // Determine role badge color
  const getRoleBadgeColor = (role: string | null) => {
    if (!role) return 'bg-gray-100 text-gray-600';
    
    const adminRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'ADMIN'];
    const clinicalRoles = ['NURSE', 'CLINICAL', 'NURSE_RN', 'NURSE_LPN'];
    const coordinatorRoles = ['COORDINATOR', 'SCHEDULER'];
    
    if (adminRoles.includes(role)) return 'bg-purple-100 text-purple-700';
    if (clinicalRoles.includes(role)) return 'bg-teal-100 text-teal-700';
    if (coordinatorRoles.includes(role)) return 'bg-blue-100 text-blue-700';
    if (role === 'CAREGIVER') return 'bg-green-100 text-green-700';
    if (role === 'FAMILY' || role === 'CLIENT') return 'bg-pink-100 text-pink-700';
    
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-3 sm:px-4">
        {/* Left: Hamburger menu + Logo */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 mr-2 sm:mr-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden min-w-[44px] min-h-[44px] h-11 w-11 p-0 flex items-center justify-center shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="flex items-center min-w-0 overflow-hidden">
            {/* Icon-only mark below 360px (e.g. 320px) to ensure legibility and eliminate overlap */}
            <div
              className="block min-[360px]:hidden w-9 h-9 overflow-hidden shrink-0 rounded"
              title="Marquette Home Care"
              data-testid="header-logo-icon"
            >
              <img
                src={mqtLogo}
                alt="Marquette Home Care"
                className="h-9 w-auto max-w-none object-left"
              />
            </div>

            {/* Scaled full logo for >= 360px widths (375px, 390px, 430px, and desktop) */}
            <img
              src={mqtLogo}
              alt="Marquette Home Care"
              title="Marquette Home Care"
              data-testid="header-logo-full"
              className="hidden min-[360px]:block h-7 min-[390px]:h-8 sm:h-9 md:h-10 w-auto max-w-full object-contain object-left shrink"
            />
          </div>
        </div>

        {/* Right: Bell notifications + Profile avatar */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="min-w-[44px] min-h-[44px] h-11 w-11 p-0 flex items-center justify-center shrink-0"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <div className="flex items-center gap-1 justify-end">
                <Shield className="h-3 w-3 text-gray-400" />
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${getRoleBadgeColor(
                    primaryRole
                  )}`}
                >
                  {roleLabel}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-w-[44px] min-h-[44px] h-11 w-11 rounded-full shrink-0"
              aria-label="User profile"
            >
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <User className="h-5 w-5" />
              </div>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
