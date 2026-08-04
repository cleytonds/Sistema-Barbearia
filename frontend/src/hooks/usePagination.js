import { useState } from 'react';
export const MAX_PAGE_SIZE = 100;
export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState(1),
    [limit, setLimitState] = useState(Math.min(initialLimit, MAX_PAGE_SIZE));
  const setLimit = (value) => {
    setLimitState(Math.max(1, Math.min(Number(value), MAX_PAGE_SIZE)));
    setPage(1);
  };
  return { page, limit, setPage, setLimit, params: { page, limit } };
}
