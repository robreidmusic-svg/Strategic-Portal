export type AppTheme = 'light' | 'dark' | 'mono' | 'nord' | 'matrix';

export type Unit = 'Hyperscale' | 'Strategic Wholesale' | 'China/Apac' | 'U.S AI';

export interface Opportunity {
  id: string;
  oppIdentifier: string;
  owner: string;
  customer: string;
  mrc: number;
  closeDate: string;
  forecastMonth: string; // YYYY-MM
  stage: string;
  nextStep: string;
  unit: Unit;
  isIncludedInCall?: boolean;
  timeRisk?: boolean;
}

export interface ChurnEntry {
  id: string;
  customerName: string;
  serviceType: string;
  mrc: number;
  month: string; // YYYY-MM
  unit: Unit;
  timestamp: number;
}

export interface Quota {
  monthly: number;
  annual: number;
}

export interface UnitQuotas {
  [key: string]: Quota;
}

export interface ForecastSubmission {
  unit: Unit;
  month: string; // YYYY-MM
  low: number;
  upside: number;
  call: number;
  // Churn Specifics
  churnLow: number;
  churnCall: number;
  churnWorstCase: number;
  timestamp: number;
  oppIds?: string[]; // IDs of opportunities included in the call at this time
  type?: 'submission' | 'reset_snapshot';
}

export interface HistoricalPerformance {
  unit: Unit;
  month: string; // YYYY-MM
  totalBooked: number;
}

export interface AIInfographic {
  executive_summary: string;
  strategic_pillars: {
    icon: string;
    title: string;
    description: string;
  }[];
  relationship_map: {
    name: string;
    role: string;
    sentiment: 'Positive' | 'Neutral' | 'Negative';
  }[];
  action_plan: string[];
}
