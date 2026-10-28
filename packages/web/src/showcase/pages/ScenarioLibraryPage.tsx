/**
 * Scenario Library Page
 *
 * Browse and start narrative-driven scenarios
 */

import React from 'react';
import { motion } from 'framer-motion';
import { allScenarios, useScenario } from '../scenarios';
import { Scenario, PersonaRole } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const ScenarioLibraryPage: React.FC = () => {
  const { startScenario } = useScenario();

  const handleStartScenario = (scenario: Scenario) => {
    startScenario(scenario);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Scenarios
          </h1>
          <p className="text-xl text-gray-600">
            Explore workflows
          </p>
        </motion.div>

        {/* Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allScenarios.map((scenario, index) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onStart={() => handleStartScenario(scenario)}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Supporting Components

interface ScenarioCardProps {
  scenario: Scenario;
  onStart: () => void;
  delay: number;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, onStart, delay }) => {
  const roleLabels: Record<PersonaRole, string> = {
    admin: 'Administrator',
    coordinator: 'Care Coordinator',
    caregiver: 'Caregiver',
    patient: 'Patient/Family',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <Card className="border-2 border-gray-200 hover:border-gray-900 transition-all h-full flex flex-col justify-between">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <CardTitle className="text-xl font-bold text-gray-900 leading-tight">
              {scenario.title}
            </CardTitle>
            <Badge variant="secondary" className="whitespace-nowrap shrink-0">
              {roleLabels[scenario.role]}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">{roleLabels[scenario.role]}</p>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <Button
            onClick={onStart}
            className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors h-auto"
          >
            Start
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
