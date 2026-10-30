/**
 * Feature Comparison Table
 *
 * Compares showcase vs. full demo features
 */

import React from 'react';
import {
  Server,
  Database,
  Lock,
  RefreshCw,
  Users,
  HardDrive,
  MapPin,
  Smartphone,
  Zap,
  Compass,
  CheckCircle,
  X,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js';

interface ComparisonItem {
  feature: string;
  showcase: string | React.ReactNode;
  fullDemo: string | React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}

interface ComparisonCategory {
  category: string;
  items: ComparisonItem[];
}

const comparisonData: ComparisonCategory[] = [
  {
    category: 'Infrastructure',
    items: [
      {
        feature: 'Hosting',
        showcase: 'GitHub Pages (Static)',
        fullDemo: 'Vercel (SSR + API)',
        icon: Server,
      },
      {
        feature: 'Data Storage',
        showcase: 'Browser localStorage',
        fullDemo: 'PostgreSQL + Neon',
        icon: Database,
      },
      {
        feature: 'Authentication',
        showcase: 'None (open access)',
        fullDemo: 'JWT with refresh tokens',
        icon: Lock,
      },
      {
        feature: 'Real-time Sync',
        showcase: <X className="h-5 w-5 text-red-500" />,
        fullDemo: <Check className="h-5 w-5 text-green-500" />,
        icon: RefreshCw,
      },
    ],
  },
  {
    category: 'Features',
    items: [
      {
        feature: 'Role Switching',
        showcase: '✓ Instant',
        fullDemo: '✓ Full auth required',
        icon: Users,
      },
      {
        feature: 'Data Persistence',
        showcase: 'Browser only',
        fullDemo: 'Database + backup',
        icon: HardDrive,
      },
      {
        feature: 'EVV Compliance',
        showcase: 'UI simulation',
        fullDemo: 'Full GPS + validation',
        icon: MapPin,
      },
      {
        feature: 'Mobile App',
        showcase: 'Simulated UI',
        fullDemo: 'Native React Native',
        icon: Smartphone,
      },
    ],
  },
  {
    category: 'Use Cases',
    items: [
      {
        feature: 'Quick Demo',
        showcase: <><Check className="h-5 w-5 text-green-500 inline" /> Perfect</>,
        fullDemo: 'Requires signup',
        icon: Zap,
      },
      {
        feature: 'Feature Exploration',
        showcase: <><Check className="h-5 w-5 text-green-500 inline" /> Excellent</>,
        fullDemo: <><Check className="h-5 w-5 text-green-500 inline" /> Full access</>,
        icon: Compass,
      },
      {
        feature: 'Production Use',
        showcase: <><X className="h-5 w-5 text-red-500 inline" /> Demo only</>,
        fullDemo: <><Check className="h-5 w-5 text-green-500 inline" /> Production-ready</>,
        icon: CheckCircle,
      },
      {
        feature: 'Team Collaboration',
        showcase: <><X className="h-5 w-5 text-red-500 inline" /> Local only</>,
        fullDemo: <><Check className="h-5 w-5 text-green-500 inline" /> Multi-user</>,
        icon: Users,
      },
    ],
  },
];

export const ComparisonTable: React.FC = () => {
  return (
    <Card className="bg-white rounded-lg shadow-lg overflow-hidden border-gray-200">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 space-y-2">
        <CardTitle className="text-2xl font-bold text-white">Showcase vs. Full Demo</CardTitle>
        <CardDescription className="text-purple-100 text-base">
          Understand the differences between this interactive showcase and the full production-ready demo
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature</TableHead>
              <TableHead>Showcase (This Site)</TableHead>
              <TableHead className="bg-blue-50">Full Demo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonData.map((category) => (
              <React.Fragment key={category.category}>
                {/* Category Header */}
                <TableRow className="bg-gray-100">
                  <TableCell colSpan={3} className="text-sm font-semibold text-gray-900">
                    {category.category}
                  </TableCell>
                </TableRow>

                {/* Category Items */}
                {category.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TableRow key={item.feature}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{item.feature}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {item.showcase}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900 font-medium bg-blue-50">
                        {item.fullDemo}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <CardFooter className="bg-gray-50 p-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          Want to try the full demo with database persistence and authentication?
        </p>
        <Button
          onClick={() => window.open('https://folk.care', '_blank', 'noopener,noreferrer')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 h-auto"
        >
          Visit Full Demo →
        </Button>
      </CardFooter>
    </Card>
  );
};
