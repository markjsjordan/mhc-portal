import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Label } from '@/components/ui/label.js';
import { useApiClient } from '@/core/hooks';
import './InvitePanel.css';

interface PendingInvite {
  inviteId: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface ApiResponse<T> {
  data: {
    data: T;
  };
}

interface ApiErrorResponse {
  response?: {
    data?: {
      error?: string;
    };
  };
}

interface InvitePanelProps {
  organizationId: string;
}

export function InvitePanel({ organizationId }: Readonly<InvitePanelProps>): React.JSX.Element {
  const api = useApiClient();
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'TEAM_MEMBER',
    permissions: [] as string[],
    expiresInHours: 24,
  });
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availablePermissions = [
    'VIEW_SHIFTS',
    'MANAGE_SCHEDULE',
    'VIEW_CLIENTS',
    'MANAGE_CLIENTS',
    'VIEW_PAYROLL',
    'MANAGE_PAYROLL',
  ];

  const loadPendingInvites = useCallback(async () => {
    try {
      const response = (await api.get(
        `/api/organizations/${organizationId}/invites?status=PENDING`
      )) as ApiResponse<{ invites?: PendingInvite[] }>;
      setPendingInvites(response.data.data.invites ?? []);
    } catch (error) {
      console.error('Failed to load invites', error);
    }
  }, [api, organizationId]);

  useEffect(() => {
    void loadPendingInvites();
  }, [loadPendingInvites]);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = (await api.post(
        `/api/organizations/${organizationId}/invites/generate`,
        {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          permissions: formData.permissions,
          expiresInHours: formData.expiresInHours,
        }
      )) as ApiResponse<{ inviteUrl: string }>;

      setGeneratedUrl(response.data.data.inviteUrl);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'TEAM_MEMBER',
        permissions: [],
        expiresInHours: 24,
      });
      await loadPendingInvites();
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      setErrors({ submit: err.response?.data?.error ?? 'Failed to generate invite' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = () => {
    void navigator.clipboard.writeText(generatedUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="invite-panel">
      <h2>Invite Team Member</h2>
      
      <form onSubmit={(e) => { void handleGenerateInvite(e); }}>
        <div className="form-group">
          <Label htmlFor="invite-email">Email *</Label>
          <Input
            id="invite-email"
            type="email"
            value={formData.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
            disabled={isLoading}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="invite-first-name">First Name *</Label>
            <Input
              id="invite-first-name"
              value={formData.firstName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <Label htmlFor="invite-last-name">Last Name *</Label>
            <Input
              id="invite-last-name"
              value={formData.lastName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="form-group">
          <Label className="block mb-2">Permissions *</Label>
          <div className="permissions-grid">
            {availablePermissions.map((p) => (
              <div key={p} className="flex items-center space-x-2">
                <Checkbox
                  id={`perm-${p}`}
                  checked={formData.permissions.includes(p)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFormData({ ...formData, permissions: [...formData.permissions, p] });
                    } else {
                      setFormData({ ...formData, permissions: formData.permissions.filter(x => x !== p) });
                    }
                  }}
                  disabled={isLoading}
                />
                <Label htmlFor={`perm-${p}`} className="cursor-pointer font-normal text-sm">{p}</Label>
              </div>
            ))}
          </div>
        </div>

        {errors.submit && (
          <p className="text-sm text-red-600" role="alert">{errors.submit}</p>
        )}

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Invite URL'}
        </Button>
      </form>

      {generatedUrl && (
        <div className="generated-section">
          <h3>✓ Invite URL Generated</h3>
          <code>{generatedUrl}</code>
          <Button onClick={handleCopyUrl}>
            {isCopied ? '✓ Copied!' : 'Copy URL'}
          </Button>
        </div>
      )}

      <div className="pending-section">
        <h3>Pending Invitations</h3>
        {pendingInvites.length === 0 ? (
          <p>No pending invitations</p>
        ) : (
          <ul>
            {pendingInvites.map((invite) => (
              <li key={invite.inviteId}>
                {invite.firstName} {invite.lastName} ({invite.email})
                <Button onClick={() => {/* revoke */}}>Revoke</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
