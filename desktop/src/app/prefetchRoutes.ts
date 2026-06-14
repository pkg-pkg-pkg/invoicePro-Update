import { prefetchAllAppRoutes } from './routePrefetch';

/** @deprecated use prefetchAllAppRoutes — kept for callers */
export function prefetchFrequentRoutes(): void {
  prefetchAllAppRoutes();
}

export { prefetchAllAppRoutes, prefetchRoutePath } from './routePrefetch';
