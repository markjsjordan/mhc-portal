import React from 'react';
import { CustomLoginForm } from '@/app/components/CustomLoginForm';
import mqtLogoRetina from '@/assets/mqt-logo-retina.png';

export const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="mb-3 flex justify-center">
            <img
              src={mqtLogoRetina}
              alt="Marquette Home Care"
              data-testid="login-logo"
              className="h-16 sm:h-20 w-auto max-w-full object-contain"
            />
          </h1>
        </div>

        {/* Custom Login Form */}
        <CustomLoginForm />
      </div>
    </div>
  );
};
