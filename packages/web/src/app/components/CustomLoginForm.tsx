import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useAuthService } from '@/core/hooks';
import { getDashboardRoute } from '@/core/utils';
import { handleSmartLogin } from '@/core/utils/auth-storage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CustomLoginFormProps {
  onLoginSuccess?: () => void;
}

export const CustomLoginForm: React.FC<CustomLoginFormProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const authService = useAuthService();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState<number | null>(null);

  // Cooldown timer effect
  React.useEffect((): void | (() => void) => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Rate limit countdown effect
  React.useEffect((): void | (() => void) => {
    if (rateLimitRetryAfter !== null && rateLimitRetryAfter > 0) {
      const timer = setTimeout(() => {
        setRateLimitRetryAfter(rateLimitRetryAfter - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitRetryAfter === 0) {
      setRateLimitRetryAfter(null);
    }
  }, [rateLimitRetryAfter]);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Prevent multiple rapid submissions
    if (isLoading || cooldownSeconds > 0) {
      return;
    }

    // Prevent login if rate limited
    if (rateLimitRetryAfter !== null && rateLimitRetryAfter > 0) {
      setError(`Please wait ${rateLimitRetryAfter} seconds before trying again.`);
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setCooldownSeconds(2); // 2 second cooldown between attempts

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
      });

      // Smart demo mode: Auto-clear stale auth data if database was reset
      const wasStale = handleSmartLogin(email, response.user);
      if (wasStale) {
        console.log('🔄 Database was reset - cleared stale auth data');
      }

      login(response.user, response.token);
      toast.success(`Welcome, ${response.user.name}!`);

      // Route based on user role using centralized routing logic
      const dashboardRoute = getDashboardRoute(response.user.roles);
      
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      
      navigate(dashboardRoute);
    } catch (error: unknown) {
      // Enhanced error handling for rate limiting
      if (error instanceof Error) {
        const errorObj = error as {
          message: string;
          response?: {
            data?: {
              code?: string;
              context?: { retryAfter?: number };
            };
          };
        };

        if (errorObj.response?.data?.code === 'RATE_LIMIT_EXCEEDED') {
          const retryAfter = errorObj.response.data.context?.retryAfter ?? 300;
          setRateLimitRetryAfter(retryAfter);
          const minutes = Math.ceil(retryAfter / 60);
          setError(
            `Too many login attempts. Please wait ${minutes} minute${
              minutes > 1 ? 's' : ''
            } before trying again.`
          );
          toast.error(
            `Too many login attempts. Please wait ${minutes} minute${
              minutes > 1 ? 's' : ''
            } before trying again.`,
            { duration: 6000 }
          );
        } else {
          const errorMessage =
            errorObj.message || 'Login failed. Please check your credentials.';
          setError(errorMessage);
          toast.error(errorMessage);
        }
      } else {
        const errorMessage = 'Login failed. Please check your credentials.';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || cooldownSeconds > 0 || (rateLimitRetryAfter !== null && rateLimitRetryAfter > 0);

  let submitLabel: React.ReactElement;
  if (isLoading) {
    submitLabel = (
      <>
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        <span>Logging in...</span>
      </>
    );
  } else if (cooldownSeconds > 0) {
    submitLabel = <span>Wait {cooldownSeconds}s...</span>;
  } else {
    submitLabel = <span>Sign In</span>;
  }

  return (
    <Card className="shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <AlertTitle>Login Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null); // Clear error when user starts typing
              }}
              placeholder="you@example.com"
              disabled={isDisabled}
              autoComplete="email"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null); // Clear error when user starts typing
              }}
              placeholder="••••••••"
              disabled={isDisabled}
              autoComplete="current-password"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isDisabled}
            className="w-full"
          >
            {submitLabel}
          </Button>

          {/* Forgot Password Link */}
          <div className="text-center">
            <a
              href="#"
              className="text-sm text-primary hover:underline font-medium"
              onClick={(e) => {
                e.preventDefault();
                toast.error('Password reset is not yet available');
              }}
            >
              Forgot your password?
            </a>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex-col border-t pt-6">
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <a
            href="/signup"
            className="text-primary hover:underline font-medium"
          >
            Sign up here
          </a>
        </p>
      </CardFooter>
    </Card>
  );
};
