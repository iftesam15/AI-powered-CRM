/** Standard error body returned by the FastAPI layer and the BFF routes. */
export interface ApiErrorBody {
  detail: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Envelope every list endpoint returns, mirroring `core/pagination.py`.
 * `total` counts every row matching the filter, ignoring paging.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
