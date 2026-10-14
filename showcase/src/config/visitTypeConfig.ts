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
import type { VisitType } from '../types/showcase-types';

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
}

export const VISIT_TYPES: Record<VisitType, VisitTypeConfig> = {
  REGULAR: {
    type: 'REGULAR',
    label: 'Regular Visit',
    icon: Calendar,
    color: 'blue',
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Standard scheduled home care service visit',
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
    description: 'First intake and onboarding visit for a new client',
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
    description: 'Final transition of care and discharge evaluation',
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
    description: 'Temporary relief care supporting primary family caregivers',
  },
  EMERGENCY: {
    type: 'EMERGENCY',
    label: 'Emergency Visit',
    icon: AlertCircle,
    color: 'red',
    colorClass: 'text-red-600',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    description: 'Unscheduled urgent care dispatch and critical response',
  },
  MAKEUP: {
    type: 'MAKEUP',
    label: 'Makeup Visit',
    icon: RotateCcw,
    color: 'amber',
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Rescheduled makeup session for a missed or cancelled visit',
  },
  SUPERVISION: {
    type: 'SUPERVISION',
    label: 'Supervision Visit',
    icon: Eye,
    color: 'indigo',
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'RN/Supervisor compliance review and caregiver field assessment',
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
    description: 'Comprehensive clinical needs assessment and plan of care update',
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
  },
};

export const getVisitTypeConfig = (type: VisitType | string): VisitTypeConfig => {
  const normalized = (type || '').toUpperCase() as VisitType;
  return VISIT_TYPES[normalized] || VISIT_TYPES.REGULAR;
};
