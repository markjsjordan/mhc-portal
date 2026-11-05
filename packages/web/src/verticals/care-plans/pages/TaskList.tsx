import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { TaskClientPicker, TaskInstanceList } from '../components';

export const TaskList: React.FC = () => {
  const [mode, setMode] = useState<'client' | 'all'>('client');
  const [selectedClient, setSelectedClient] = useState<{ id: string; displayName: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleBackToClientSearch = () => {
    setMode('client');
    setSelectedClient(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by client, caregiver, service, address, or visit #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 bg-white"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 h-6 w-6"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {mode === 'client' && !selectedClient && (
        <div className="space-y-4">
          <TaskClientPicker
            onSelectClient={(c) =>
              setSelectedClient({
                id: c.id,
                displayName: c.preferredName ?? `${c.firstName} ${c.lastName}`,
              })
            }
          />
          <Button variant="outline" onClick={() => setMode('all')}>
            View All Clients
          </Button>
        </div>
      )}

      {mode === 'client' && selectedClient && (
        <div className="space-y-6">
          <Button variant="outline" onClick={() => setSelectedClient(null)}>
            Back to client search
          </Button>
          <h2 className="text-xl font-semibold text-gray-900">{selectedClient.displayName}</h2>
          <TaskInstanceList clientId={selectedClient.id} showFilters={true} showViewToggle={true} />
        </div>
      )}

      {mode === 'all' && (
        <div className="space-y-6">
          <Button variant="outline" onClick={handleBackToClientSearch}>
            Back to client search
          </Button>
          <TaskInstanceList showFilters={true} showViewToggle={true} />
        </div>
      )}
    </div>
  );
};
