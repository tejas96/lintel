export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function pageOffset(request: PageRequest): number {
  return (request.page - 1) * request.pageSize;
}

export function buildPage<T>(
  items: readonly T[],
  request: PageRequest,
  totalItems: number,
): Page<T> {
  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / request.pageSize)),
  };
}
