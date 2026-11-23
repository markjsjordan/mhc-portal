import {
  Calendar,
  UserPlus,
  Eye,
  ClipboardCheck,
  Gem,
  type LucideIcon,
} from 'lucide-react';
import type { VisitType } from '../types';

export interface VisitTypeConfig {
  type: VisitType;
  label: string;
  icon: LucideIcon;
  color: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  description: string;
  typicalDuration: number; // minutes
  careLevel: 'LOW' | 'STANDARD' | 'MEDIUM_HIGH' | 'HIGH';
  requiredCertifications: string[];
  billingRate: string;
}

export const VISIT_TYPES: Record<VisitType, VisitTypeConfig> = {
  REGULAR: {
    type: 'REGULAR',
    label: 'Home Care Visit',
    icon: Calendar,
    color: 'green',
    colorClass: 'text-green-600',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    description: 'Standard recurring ADL assistance, medication reminders',
    typicalDuration: 60,
    careLevel: 'STANDARD',
    requiredCertifications: [],
    billingRate: 'STANDARD',
  },
  INITIAL: {
    type: 'INITIAL',
    label: 'Med Check',
    icon: UserPlus,
    color: 'emerald',
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Medical check & comprehensive assessment with new client',
    typicalDuration: 90,
    careLevel: 'HIGH',
    requiredCertifications: ['RN', 'LPN'],
    billingRate: 'INITIAL_VISIT',
  },
  SUPERVISION: {
    type: 'SUPERVISION',
    label: 'Nurse Visit',
    icon: Eye,
    color: 'indigo',
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'RN supervision, wound care, complex medical needs',
    typicalDuration: 45,
    careLevel: 'MEDIUM_HIGH',
    requiredCertifications: ['RN'],
    billingRate: 'SUPERVISION',
  },
  ASSESSMENT: {
    type: 'ASSESSMENT',
    label: 'Care Management',
    icon: ClipboardCheck,
    color: 'teal',
    colorClass: 'text-teal-600',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'Periodic care management and re-assessment',
    typicalDuration: 60,
    careLevel: 'MEDIUM_HIGH',
    requiredCertifications: ['RN', 'LPN'],
    billingRate: 'ASSESSMENT',
  },
  CONCIERGE: {
    type: 'CONCIERGE',
    label: 'Concierge Visit',
    icon: Gem,
    color: 'pink',
    colorClass: 'text-pink-600',
    bgClass: 'bg-pink-50',
    borderClass: 'border-pink-200',
    badgeClass: 'bg-pink-100 text-pink-800 border-pink-200',
    description: 'Premium companion care, errands, social engagement',
    typicalDuration: 120,
    careLevel: 'LOW',
    requiredCertifications: [],
    billingRate: 'CONCIERGE',
  },
};

export const getVisitTypeConfig = (type: VisitType | string): VisitTypeConfig => {
  const normalized = (type || '').toUpperCase();
  return (VISIT_TYPES as Record<string, VisitTypeConfig>)[normalized] ?? VISIT_TYPES.REGULAR;
};

/**
 * Get all visit types for UI lists
 */
export const getAllVisitTypes = (): VisitType[] => {
  return Object.keys(VISIT_TYPES) as VisitType[];
};

/**
 * Get visit types that require nurse certification
 */
export const getNurseRequiredVisitTypes = (): VisitType[] => {
  return Object.entries(VISIT_TYPES)
    .filter(([_, config]) => config.requiredCertifications.includes('RN'))
    .map(([type]) => type as VisitType);
};

/**
 * Validate if a visit type is valid
 */
export const isValidVisitType = (type: unknown): type is VisitType => {
  return typeof type === 'string' && type.toUpperCase() in VISIT_TYPES;
};
