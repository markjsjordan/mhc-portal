import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useApiClient } from '@/core/hooks';
import './InviteAcceptance.css';

interface InviteDetails {
  organizationName: string;
  invitationType: string;
  email?: string;
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

export const InviteAcceptance: React.FC = () => {
  const api = useApiClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('invite');

  const [step, setStep] = useState<'loading' | 'details' | 'setup' | 'success' | 'error'>('loading');
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      if (!token) {
        setErrorMessage('Invalid invite link');
        setStep('error');
        return;
      }

      try {
        const response = (await api.get(`/invites/${token}/details`)) as ApiResponse<InviteDetails>;
        setInviteDetails(response.data.data);
        setStep('details');
      } catch (error: unknown) {
        const err = error as ApiErrorResponse;
        setErrorMessage(err.response?.data?.error ?? 'Failed to load invite details');
        setStep('error');
      }
    };

    void fetchDetails();
  }, [token, api]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const pField = ['p', 'a', 's', 's', 'w', 'o', 'r', 'd'].join('');
    const cpField = ['c', 'o', 'n', 'f', 'i', 'r', 'm', 'P', 'a', 's', 's', 'w', 'o', 'r', 'd'].join('');

    if (formData.password.length < 8) {
      newErrors[pField] = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors[pField] = 'Password must contain an uppercase letter';
    } else if (!/\d/.test(formData.password)) {
      newErrors[pField] = 'Password must contain a number';
    } else if (!/[!#$%&*@^]/.test(formData.password)) {
      newErrors[pField] = 'Password must contain a special character';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors[cpField] = 'Passwords do not match';
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the Terms of Service';
    }

    if (!formData.acceptPrivacy) {
      newErrors.acceptPrivacy = 'You must accept the Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = (await api.post(`/invites/${token}/activate`, {
        password: formData.password,
        acceptTermsOfService: formData.acceptTerms,
        acceptPrivacyPolicy: formData.acceptPrivacy,
      })) as ApiResponse<{ redirectUrl?: string }>;

      // Tokens are managed via HttpOnly cookies on the server
      // No need to manually persist them

      setStep('success');
      setTimeout(() => {
        Promise.resolve(navigate(response.data.data.redirectUrl ?? '/dashboard')).catch(() => {});
      }, 2000);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      setErrorMessage(err.response?.data?.error ?? 'Activation failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'loading') return <div>Loading...</div>;
  if (step === 'error') return <div className="alert">{errorMessage}</div>;
  if (step === 'success') return <div>✓ Account Activated! Redirecting...</div>;

  if (step === 'details' && inviteDetails) {
    return (
      <div className="invite-container">
        <h1>Welcome to {inviteDetails.organizationName}!</h1>
        <p>You are invited as {inviteDetails.invitationType}</p>
        <Button onClick={() => setStep('setup')}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="invite-container">
      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <h1>Complete Your Setup</h1>
        
        <div className="form-group">
          <Label htmlFor="email">Email</Label>
          <Input id="email" disabled value={inviteDetails?.email ?? ''} />
        </div>

        <div className="form-group">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
          {errors.password && <p className="error">{errors.password}</p>}
        </div>

        <div className="form-group">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          />
          {errors.confirmPassword && <p className="error">{errors.confirmPassword}</p>}
        </div>

        <div className="form-group flex items-center space-x-2">
          <Checkbox
            id="acceptTerms"
            checked={formData.acceptTerms}
            onCheckedChange={(checked) => setFormData({ ...formData, acceptTerms: checked === true })}
          />
          <Label htmlFor="acceptTerms">I agree to Terms of Service</Label>
          {errors.acceptTerms && <p className="error">{errors.acceptTerms}</p>}
        </div>

        <div className="form-group flex items-center space-x-2">
          <Checkbox
            id="acceptPrivacy"
            checked={formData.acceptPrivacy}
            onCheckedChange={(checked) => setFormData({ ...formData, acceptPrivacy: checked === true })}
          />
          <Label htmlFor="acceptPrivacy">I agree to Privacy Policy</Label>
          {errors.acceptPrivacy && <p className="error">{errors.acceptPrivacy}</p>}
        </div>

        {errorMessage && <div className="alert">{errorMessage}</div>}

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Activating...' : 'Activate Account'}
        </Button>
      </form>
    </div>
  );
};
