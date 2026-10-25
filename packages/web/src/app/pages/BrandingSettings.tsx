/**
 * Branding Settings Page
 *
 * Allows organization admins to customize their white-label branding
 */

import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BrandingForm {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  brandName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
}

export default function BrandingSettings() {
  const { refreshTheme } = useTheme();
  const [form, setForm] = useState<BrandingForm>({
    logoUrl: '',
    primaryColor: '#0ea5e9',
    secondaryColor: '',
    brandName: '',
    tagline: '',
    supportEmail: '',
    supportPhone: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const response = await fetch('/api/white-label/branding', {
        credentials: 'include',
      });

      if (response.ok) {
        const branding = await response.json();
        if (branding) {
          setForm({
            logoUrl: branding.logoUrl ?? '',
            primaryColor: branding.primaryColor ?? '#0ea5e9',
            secondaryColor: branding.secondaryColor ?? '',
            brandName: branding.brandName ?? '',
            tagline: branding.tagline ?? '',
            supportEmail: branding.supportEmail ?? '',
            supportPhone: branding.supportPhone ?? '',
          });
        }
      }
    } catch (error) {
      console.error('Failed to load branding:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/white-label/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Branding updated successfully!' });
        await refreshTheme();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message ?? 'Failed to update branding' });
      }
    } catch (error) {
      console.error('Error updating branding:', error);
      setMessage({ type: 'error', text: 'An error occurred while updating branding' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Branding Settings</h1>

      {message && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'} className="mb-6">
          <AlertTitle>{message.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Visual Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="h-10 w-20"
                  />
                  <Input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="flex-1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    placeholder="#0ea5e9"
                  />
                </div>
              </div>

              <div>
                <Label>Secondary Color (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={form.secondaryColor || '#000000'}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="h-10 w-20"
                  />
                  <Input
                    type="text"
                    value={form.secondaryColor}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="flex-1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    placeholder="#6b7280"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  type="text"
                  value={form.brandName}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  placeholder="Your Agency Name"
                />
              </div>

              <div>
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Caring for your community"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                  placeholder="support@yourorganization.com"
                />
              </div>

              <div>
                <Label htmlFor="supportPhone">Support Phone</Label>
                <Input
                  id="supportPhone"
                  type="tel"
                  value={form.supportPhone}
                  onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => void loadBranding()}>
            Reset
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
