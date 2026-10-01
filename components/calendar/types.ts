export type ViewMode = 'daily' | 'monthly';
export type DayAvailability = 'free' | 'partial' | 'full' | 'closed';

export const DAYS_PAST             = 3;
export const DAYS_FUTURE           = 10;
export const MAX_VISIBLE_DAYS      = 60;
export const DAYS_TO_LOAD          = 5;
export const MIN_DATE              = new Date(2020, 0, 1);
export const SCROLL_THRESHOLD_FW   = 400;
export const SCROLL_THRESHOLD_BK   = 200;
export const STICKY_HEADER_HEIGHT  = 41;
export const SSE_RELOAD_DEBOUNCE   = 800;
export const LOCAL_MUTATION_WINDOW = 3000;
