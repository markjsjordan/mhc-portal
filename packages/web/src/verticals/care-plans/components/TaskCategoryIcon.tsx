import React from 'react';
import {
  Droplet,
  Shirt,
  Scissors,
  Home,
  Activity,
  Users,
  Pill,
  UtensilsCrossed,
  Utensils,
  Sparkles,
  Wind,
  ShoppingCart,
  Car,
  Heart,
  Eye,
  FileText,
  HelpCircle,
} from 'lucide-react';
import type { TaskCategory } from '../types';

export interface TaskCategoryIconProps {
  category: TaskCategory;
  className?: string;
}

export const TaskCategoryIcon: React.FC<TaskCategoryIconProps> = ({ category, className = 'h-5 w-5' }) => {
  const iconMap: Record<TaskCategory, React.ReactElement> = {
    PERSONAL_HYGIENE: <Droplet className={className} />,
    BATHING: <Droplet className={className} />,
    DRESSING: <Shirt className={className} />,
    GROOMING: <Scissors className={className} />,
    TOILETING: <Home className={className} />,
    MOBILITY: <Activity className={className} />,
    TRANSFERRING: <Users className={className} />,
    AMBULATION: <Activity className={className} />,
    MEDICATION: <Pill className={className} />,
    MEAL_PREPARATION: <UtensilsCrossed className={className} />,
    FEEDING: <Utensils className={className} />,
    HOUSEKEEPING: <Sparkles className={className} />,
    LAUNDRY: <Wind className={className} />,
    SHOPPING: <ShoppingCart className={className} />,
    TRANSPORTATION: <Car className={className} />,
    COMPANIONSHIP: <Heart className={className} />,
    MONITORING: <Eye className={className} />,
    DOCUMENTATION: <FileText className={className} />,
    OTHER: <HelpCircle className={className} />,
  };

  return iconMap[category];
};

