export const parseDateOnly = (value: string | Date): Date => {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    return new Date(value);
  }
  if (
    value instanceof Date &&
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  ) {
    return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  return value;
};

export const formatCalendarDate = (
  date: string | Date | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!date) return '—';
  const d = parseDateOnly(date);
  return new Intl.DateTimeFormat(
    'en-US',
    options ?? {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  ).format(d);
};

export const toDateKey = (date: string | Date): string => {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
};

export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  let d: Date;
  if (typeof date === 'string') {
    const plainMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    d = plainMatch
      ? new Date(Number(plainMatch[1]), Number(plainMatch[2]) - 1, Number(plainMatch[3]))
      : new Date(date);
  } else {
    d = date;
  }
  return new Intl.DateTimeFormat('en-US', options ?? { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }).format(d);
};

export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
};

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};
