import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useIdleLogout } from '@/core/hooks';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auto-logout authenticated (non-demo) sessions after 30 minutes of
  // inactivity. See useIdleLogout for details.
  useIdleLogout();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="lg:pl-64">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        {/* Demo Data Banner removed: not shown in the current build */}

        <main className="p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
