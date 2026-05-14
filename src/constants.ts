import { Unit } from './types';

export const UNITS: Unit[] = [
  'Hyperscale',
  'Strategic Wholesale',
  'China/Apac',
  'U.S AI'
];

export const DEFAULT_QUOTAS: Record<Unit, { monthly: number; annual: number }> = {
  'Hyperscale': { monthly: 500000, annual: 6000000 },
  'Strategic Wholesale': { monthly: 300000, annual: 3600000 },
  'China/Apac': { monthly: 200000, annual: 2400000 },
  'U.S AI': { monthly: 400000, annual: 4800000 },
};

export const FORECAST_MONTHS = [
  { label: 'Jan', value: '2026-01' },
  { label: 'Feb', value: '2026-02' },
  { label: 'Mar', value: '2026-03' },
  { label: 'Apr', value: '2026-04' },
  { label: 'May', value: '2026-05' },
  { label: 'Jun', value: '2026-06' },
  { label: 'Jul', value: '2026-07' },
  { label: 'Aug', value: '2026-08' },
  { label: 'Sep', value: '2026-09' },
  { label: 'Oct', value: '2026-10' },
  { label: 'Nov', value: '2026-11' },
  { label: 'Dec', value: '2026-12' },
];

export const WHITELISTED_USERS = [
  { firstName: 'Eva', lastName: 'Tsang', role: 'user' },
  { firstName: 'Ed', lastName: 'Wheeler', role: 'admin' },
  { firstName: 'Alfie', lastName: 'James', role: 'user' },
  { firstName: 'Abigail', lastName: 'Moore', role: 'user' },
  { firstName: 'Filaretos', lastName: 'Koutsogiannis', role: 'user' },
  { firstName: 'Keera', lastName: 'Johnstone', role: 'user' },
  { firstName: 'Rob', lastName: 'Reid', role: 'admin' }
];
