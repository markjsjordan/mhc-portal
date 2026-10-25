import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Caregiver {
  id: string;
  name: string;
  phone: string;
  email: string;
  clients: string[];
  selected: boolean;
}

interface NotificationTemplate {
  id: string;
  name: string;
  message: string;
  urgency: 'normal' | 'important' | 'urgent' | 'emergency';
}

type UrgencyLevel = 'normal' | 'important' | 'urgent' | 'emergency';

const DEMO_CAREGIVERS: Caregiver[] = [
  {
    id: 'cg-1',
    name: 'Maria Garcia',
    phone: '(512) 555-0101',
    email: 'maria@example.com',
    clients: ['Robert Johnson', 'Patricia Williams'],
    selected: false,
  },
  {
    id: 'cg-2',
    name: 'James Wilson',
    phone: '(512) 555-0102',
    email: 'james@example.com',
    clients: ['Michael Davis'],
    selected: false,
  },
  {
    id: 'cg-3',
    name: 'Sarah Chen',
    phone: '(512) 555-0103',
    email: 'sarah@example.com',
    clients: ['Dorothy Chen', 'Robert Johnson'],
    selected: false,
  },
  {
    id: 'cg-4',
    name: 'David Martinez',
    phone: '(512) 555-0104',
    email: 'david@example.com',
    clients: ['Patricia Williams', 'Michael Davis'],
    selected: false,
  },
];

const MESSAGE_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'schedule-change',
    name: 'Schedule Change',
    message: '[CLIENT]\'s visit on [DATE] has been moved from [OLD_TIME] to [NEW_TIME].',
    urgency: 'important',
  },
  {
    id: 'visit-cancelled',
    name: 'Visit Cancelled',
    message: '[CLIENT]\'s visit on [DATE] at [TIME] has been cancelled. You will be notified when it is rescheduled.',
    urgency: 'important',
  },
  {
    id: 'coverage-needed',
    name: 'Coverage Needed',
    message: 'We need coverage for [CLIENT] on [DATE] from [START_TIME] to [END_TIME]. Reply if available.',
    urgency: 'urgent',
  },
  {
    id: 'client-update',
    name: 'Client Update',
    message: 'Important update regarding [CLIENT]: [DETAILS]',
    urgency: 'normal',
  },
  {
    id: 'emergency',
    name: 'Emergency Alert',
    message: 'URGENT: [CLIENT] has been hospitalized. All visits are cancelled until further notice. Contact office immediately.',
    urgency: 'emergency',
  },
  {
    id: 'training',
    name: 'Training/Meeting',
    message: 'Mandatory training session on [DATE] at [TIME]. Location: [LOCATION]. RSVP required.',
    urgency: 'important',
  },
  {
    id: 'custom',
    name: 'Custom Message',
    message: '',
    urgency: 'normal',
  },
];

export default function BulkNotificationsPage() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>(DEMO_CAREGIVERS);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [message, setMessage] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [filterClient, setFilterClient] = useState('');
  

  const selectedCount = caregivers.filter(cg => cg.selected).length;
  const allClients = Array.from(
    new Set(caregivers.flatMap(cg => cg.clients))
  ).sort((a, b) => a.localeCompare(b));

  const handleSelectAll = () => {
    setCaregivers(caregivers.map(cg => ({ ...cg, selected: true })));
  };

  const handleDeselectAll = () => {
    setCaregivers(caregivers.map(cg => ({ ...cg, selected: false })));
  };

  const handleToggleCaregiver = (id: string) => {
    setCaregivers(
      caregivers.map(cg => (cg.id === id ? { ...cg, selected: !cg.selected } : cg))
    );
  };

  const handleSelectTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setMessage(template.message);
    setUrgency(template.urgency);
  };

  const handleFilterByClient = (client: string) => {
    setFilterClient(client);
    setCaregivers(
      caregivers.map(cg => ({
        ...cg,
        selected: client ? cg.clients.includes(client) : cg.selected,
      }))
    );
  };

  const handleSend = () => {
    if (selectedCount === 0) {
      alert('Please select at least one caregiver');
      return;
    }

    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    // FEATURE COMING SOON: Bulk notification API integration not yet implemented
    // This handler is disabled pending:
    // 1. Backend API endpoint for /api/notifications/bulk-send
    // 2. Multi-channel delivery (push, SMS, email) integration
    // 3. Delivery tracking and retry logic
    // 4. Emergency alert phone call escalation
    alert('⏳ Bulk Notifications feature is coming soon.\n\nWe are currently building the backend API to support multi-channel delivery (push notifications, SMS, and email) with delivery tracking.');
  };

  const getUrgencyColor = (level: UrgencyLevel) => {
    switch (level) {
      case 'emergency':
        return 'border-red-600';
      case 'urgent':
        return 'border-orange-600';
      case 'important':
        return 'border-amber-500';
      default:
        return 'border-blue-500';
    }
  };

  const getUrgencyBgColor = (level: UrgencyLevel) => {
    switch (level) {
      case 'emergency':
        return 'bg-red-600';
      case 'urgent':
        return 'bg-orange-600';
      case 'important':
        return 'bg-amber-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getUrgencyLabel = (level: UrgencyLevel) => {
    switch (level) {
      case 'emergency':
        return '🚨 Emergency';
      case 'urgent':
        return '⚠️ Urgent';
      case 'important':
        return '❗ Important';
      default:
        return '💬 Normal';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Bulk Caregiver Notifications</h1>
        <p className="text-sm text-gray-600">
          Send messages to multiple caregivers with delivery tracking
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left column: Recipients */}
        <div className="w-[400px]">
          <Card>
            <CardHeader>
              <CardTitle>Select Recipients ({selectedCount})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSelectAll} className="flex-1">
                  Select All
                </Button>
                <Button variant="outline" onClick={handleDeselectAll} className="flex-1">
                  Deselect All
                </Button>
              </div>

              <div>
                <Label htmlFor="filterClient">Filter by Client:</Label>
                <Select
                  value={filterClient}
                  onValueChange={handleFilterByClient}
                >
                  <SelectTrigger id="filterClient">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Clients</SelectItem>
                    {allClients.map(client => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-[500px] overflow-y-auto space-y-2">
                {caregivers.map(cg => (
                  <div
                    key={cg.id}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      cg.selected
                        ? 'bg-blue-50 border-blue-500'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleToggleCaregiver(cg.id)}
                  >
                    <div className="flex gap-3 items-start">
                      <Checkbox
                        checked={cg.selected}
                        onCheckedChange={() => handleToggleCaregiver(cg.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{cg.name}</div>
                        <div className="text-xs text-gray-600">
                          {cg.phone} • {cg.email}
                        </div>
                        <div className="text-xs text-gray-600">
                          Clients: {cg.clients.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Message */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label>Templates:</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {MESSAGE_TEMPLATES.map(template => (
                    <Button
                      key={template.id}
                      variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                      className="justify-start text-left h-auto py-2.5"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      {template.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Urgency Level:</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(['normal', 'important', 'urgent', 'emergency'] as UrgencyLevel[]).map(
                    level => (
                      <Button
                        key={level}
                        variant={urgency === level ? "default" : "outline"}
                        className={`justify-start ${
                          urgency === level ? getUrgencyBgColor(level) : ''
                        } border-2 ${getUrgencyColor(level)}`}
                        onClick={() => setUrgency(level)}
                      >
                        {getUrgencyLabel(level)}
                      </Button>
                    )
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="message">Message:</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={8}
                  className="mt-2"
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {message.length} characters
                </div>
              </div>

              <div>
                <Label>Preview:</Label>
                <div
                  className={`p-4 bg-gray-50 rounded-md border-l-4 mt-2 ${getUrgencyColor(urgency)}`}
                >
                  <div className="flex justify-between mb-2 text-sm">
                    <strong>{getUrgencyLabel(urgency)}</strong>
                    <span className="text-gray-500">Just now</span>
                  </div>
                  <div className="text-sm mb-2 whitespace-pre-wrap">
                    {message || '(No message)'}
                  </div>
                  <div className="text-xs text-gray-500">
                    To: {selectedCount} caregiver{selectedCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-md flex gap-3">
                <div className="text-xl">ℹ️</div>
                <div>
                  <div className="text-sm font-semibold text-blue-900 mb-1">
                    Multi-Channel Delivery
                  </div>
                  <div className="text-sm text-blue-900">
                    Messages will be sent via:
                    <ul className="my-2 pl-5 list-none">
                      <li>📱 Push notification (instant, if app installed)</li>
                      <li>💬 SMS text message (backup, within 1 minute)</li>
                      <li>📧 Email (backup, for record-keeping)</li>
                    </ul>
                    {urgency === 'emergency' && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-red-900">
                        <strong>Emergency alerts</strong> will also trigger phone calls to
                        caregivers who don't acknowledge within 5 minutes.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSend}
                disabled={selectedCount === 0 || !message.trim()}
                className="w-full py-4 text-base"
              >
                Send to {selectedCount} Caregiver{selectedCount !== 1 ? 's' : ''}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
