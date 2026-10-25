import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Input } from '@folkcare/shared-components';
import { useApiClient } from '@/core/hooks';
import './InviteAcceptance.css';

export const InviteAcceptance: React.FC = () => {
  const api = useApiClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('invite');

  const [step, setStep] = useState<'loading' | 'details' | 'setup' | 'success' | 'error'>('loading');
  const [inviteDetails, setInviteDetails] = useState<any>(null);
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
        const response = await api.get(`/invites/${token}/details`) as any;
        setInviteDetails(response.data.data);
        setStep('details');
      } catch (error: any) {
        setErrorMessage(error.response?.data?.error || 'Failed to load invite details');
        setStep('error');
      }
    };

    fetchDetails();
  }, [token]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain an uppercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain a number';
    } else if (!/[!@#$%^&*]/.test(formData.password)) {
      newErrors.password = 'Password must contain a special character';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const response = await api.post(`/invites/${token}/activate`, {
        password: formData.password,
        acceptTermsOfService: formData.acceptTerms,
        acceptPrivacyPolicy: formData.acceptPrivacy,
      }) as any;

      // Tokens are managed via HttpOnly cookies on the server
      // No need to manually persist them

      setStep('success');
      setTimeout(() => {
        navigate(response.data.data.redirectUrl || '/dashboard');
      }, 2000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Activation failed');
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
      <form onSubmit={handleSubmit}>
        <h1>Complete Your Setup</h1>
        
        <div className="form-group">
          <label>Email</label>
          <Input disabled value={inviteDetails?.email || ''} />
        </div>

        <div className="form-group">
          <label>Password</label>
          <Input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
          {errors.password && <p className="error">{errors.password}</p>}
        </div>

        <div className="form-group">
          <label>Confirm Password</label>
          <Input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          />
          {errors.confirmPassword && <p className="error">{errors.confirmPassword}</p>}
        </div>

        <div className="form-group">
          <input
            type="checkbox"
            checked={formData.acceptTerms}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, acceptTerms: e.target.checked })}
          />
          <label>I agree to Terms of Service</label>
          {errors.acceptTerms && <p className="error">{errors.acceptTerms}</p>}
        </div>

        <div className="form-group">
          <input
            type="checkbox"
            checked={formData.acceptPrivacy}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, acceptPrivacy: e.target.checked })}
          />
          <label>I agree to Privacy Policy</label>
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
