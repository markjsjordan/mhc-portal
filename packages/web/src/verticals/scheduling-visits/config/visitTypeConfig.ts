import {
  Calendar,
  UserPlus,
  UserMinus,
  Heart,
  AlertCircle,
  RotateCcw,
  Eye,
  ClipboardCheck,
  Gem,
  TrendingUp,
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
  careLevel: 'LOW' | 'STANDARD' | 'MEDIUM_HIGH' | 'HIGH' | 'CRITICAL' | 'VARIABLE';
  requiredCertifications: string[];
  billingRate: string;
}

export const VISIT_TYPES: Record<VisitType, VisitTypeConfig> = {
  REGULAR: {
    type: 'REGULAR',
    label: 'Regular Visit',
    icon: Calendar,
    color: 'green',
    colorClass: 'text-green-600',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    description: 'Standard recurring home care visit (ADL assistance, medication reminders)',
    typicalDuration: 60,
    careLevel: 'STANDARD',
    requiredCertifications: [],
    billingRate: 'STANDARD',
  },
  INITIAL: {
    type: 'INITIAL',
    label: 'Initial Visit',
    icon: UserPlus,
    color: 'emerald',
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'First visit with new client; comprehensive assessment and care plan development',
    typicalDuration: 90,
    careLevel: 'HIGH',
    requiredCertifications: ['RN', 'LPN'],
    billingRate: 'INITIAL_VISIT',
  },
  ASSESSMENT: {
    type: 'ASSESSMENT',
    label: 'Assessment Visit',
    icon: ClipboardCheck,
    color: 'teal',
    colorClass: 'text-teal-600',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'Periodic re-assessment of client needs and care plan effectiveness',
    typicalDuration: 60,
    careLevel: 'MEDIUM_HIGH',
    requiredCertifications: ['RN', 'LPN'],
    billingRate: 'ASSESSMENT',
  },
  RESPITE: {
    type: 'RESPITE',
    label: 'Respite Care',
    icon: Heart,
    color: 'rose',
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    description: 'Temporary relief for family caregivers; can span multiple hours',
    typicalDuration: 240,
    careLevel: 'VARIABLE',
    requiredCertifications: [],
    billingRate: 'RESPITE_CARE',
  },
  SUPERVISION: {
    type: 'SUPERVISION',
    label: 'Supervisory Nurse Visit',
    icon: Eye,
    color: 'indigo',
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Nursing oversight of care delivery and caregiver supervision',
    typicalDuration: 45,
    careLevel: 'HIGH',
    requiredCertifications: ['RN'],
    billingRate: 'SUPERVISION',
  },
  EMERGENCY: {
    type: 'EMERGENCY',
    label: 'Emergency Response',
    icon: AlertCircle,
    color: 'red',
    colorClass: 'text-red-600',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    description: 'Urgent response to client crisis or emergency situation',
    typicalDuration: 30,
    careLevel: 'CRITICAL',
    requiredCertifications: [],
    billingRate: 'EMERGENCY',
  },
  DISCHARGE: {
    type: 'DISCHARGE',
    label: 'Discharge Visit',
    icon: UserMinus,
    color: 'purple',
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Final visit upon client discharge or end of service',
    typicalDuration: 60,
    careLevel: 'STANDARD',
    requiredCertifications: [],
    billingRate: 'STANDARD',
  },
  MAKEUP: {
    type: 'MAKEUP',
    label: 'Make-up Visit',
    icon: RotateCcw,
    color: 'amber',
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Rescheduled visit for previously missed appointment',
    typicalDuration: 60,
    careLevel: 'STANDARD',
    requiredCertifications: [],
    billingRate: 'STANDARD',
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
    description: 'Premium personal services (errands, companionship, shopping)',
    typicalDuration: 120,
    careLevel: 'LOW',
    requiredCertifications: [],
    billingRate: 'CONCIERGE',
  },
  ONGOING_SUPPORT: {
    type: 'ONGOING_SUPPORT',
    label: 'Ongoing Support',
    icon: TrendingUp,
    color: 'cyan',
    colorClass: 'text-cyan-600',
    bgClass: 'bg-cyan-50',
    borderClass: 'border-cyan-200',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Continued monitoring and support between scheduled visits',
    typicalDuration: 30,
    careLevel: 'STANDARD',
    requiredCertifications: [],
    billingRate: 'ONGOING_SUPPORT',
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
