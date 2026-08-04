import { useEffect } from 'react';
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} | Elite Barbearia 081`;
  }, [title]);
}
