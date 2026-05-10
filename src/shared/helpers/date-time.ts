export const formatDate = (
  date: Date | string,
  formatStr: string = 'yyyy-MM-dd'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) throw new Error('Invalid date');

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (formatStr === 'yyyy-MM-dd') {
    return `${year}-${month}-${day}`;
  }

  // For other formats, return ISO for now
  return d.toISOString().split('T')[0];
};

export const formatDateTime = (
  date: Date | string,
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) throw new Error('Invalid date');

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  if (formatStr === 'yyyy-MM-dd HH:mm:ss') {
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  return d.toISOString();
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

export const addMinutes = (date: Date, minutes: number): Date => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

export const isExpired = (date: Date): boolean => {
  return new Date() > date;
};

export const getTimeDifference = (from: Date, to: Date): number => {
  return to.getTime() - from.getTime();
};

export const getDaysDifference = (from: Date, to: Date): number => {
  return Math.floor(getTimeDifference(from, to) / (1000 * 60 * 60 * 24));
};
