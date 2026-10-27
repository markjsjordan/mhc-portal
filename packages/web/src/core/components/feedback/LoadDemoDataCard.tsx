/**
 * Load Demo Data Card
 *
 * Shown on empty dashboards to help new users get started.
 * Provides a one-click way to load sample data.
 */

import React from 'react';
import { Database, Users, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';

export interface LoadDemoDataCardProps {
  onLoadDemo: () => void;
  onSkip?: () => void;
  isLoading?: boolean;
}

export const LoadDemoDataCard: React.FC<LoadDemoDataCardProps> = ({
  onLoadDemo,
  onSkip,
  isLoading = false,
}) => {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Get started with sample data
          </h2>
          <p className="text-muted-foreground mb-6">
            Load realistic sample data to explore MHC Portal features.
            You can remove it anytime and add your real data when ready.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-muted/50 rounded-lg">
              <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <div className="text-lg font-semibold text-foreground">60</div>
              <div className="text-xs text-muted-foreground">Clients</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <div className="text-lg font-semibold text-foreground">35</div>
              <div className="text-xs text-muted-foreground">Caregivers</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <Calendar className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <div className="text-lg font-semibold text-foreground">600+</div>
              <div className="text-xs text-muted-foreground">Visits</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="default"
              size="lg"
              onClick={onLoadDemo}
              disabled={isLoading}
            >
              {isLoading ? (
                <>Loading...</>
              ) : (
                <>
                  Load Sample Data
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            {onSkip && (
              <Button
                variant="outline"
                size="lg"
                onClick={onSkip}
              >
                Skip, I'll add my own data
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
