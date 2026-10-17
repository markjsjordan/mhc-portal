import { useState, useEffect } from 'react';
import { Button, Input } from '@folkcare/shared-components';
import { useApiClient } from '@/core/hooks';
import './InvitePanel.css';

interface InvitePanelProps {
  organizationId: string;
}

export function InvitePanel({ organizationId }: InvitePanelProps): React.JSX.Element {
  const api = useApiClient();
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'TEAM_MEMBER',
    permissions: [] as string[],
    expiresInHours: 24,
  });
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
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

  useEffect(() => {
    loadPendingInvites();
  }, [organizationId]);

  const loadPendingInvites = async () => {
    try {
      const response = await api.get(`/api/organizations/${organizationId}/invites?status=PENDING`) as any;
      setPendingInvites(response.data.data.invites || []);
    } catch (error) {
      console.error('Failed to load invites', error);
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.post(
        `/api/organizations/${organizationId}/invites/generate`,
        {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          permissions: formData.permissions,
          expiresInHours: formData.expiresInHours,
        }
      ) as any;

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
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Failed to generate invite' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(generatedUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="invite-panel">
      <h2>Invite Team Member</h2>
      
      <form onSubmit={handleGenerateInvite}>
        <div className="form-group">
          <label>Email *</label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
            disabled={isLoading}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>First Name *</label>
            <Input
              value={formData.firstName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label>Last Name *</label>
            <Input
              value={formData.lastName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Permissions *</label>
          <div className="permissions-grid">
            {availablePermissions.map((p) => (
              <div key={p}>
              <input
                type="checkbox"
                checked={formData.permissions.includes(p)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (e.target.checked) {
                    setFormData({ ...formData, permissions: [...formData.permissions, p] });
                  } else {
                    setFormData({ ...formData, permissions: formData.permissions.filter(x => x !== p) });
                  }
                }}
                disabled={isLoading}
              />
                <label>{p}</label>
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
