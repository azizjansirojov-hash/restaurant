import { QueryClient } from '@tanstack/react-query';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export const queryKeys = {
  profile: ['profile'] as const,
  menu: ['menu'] as const,
  categories: ['categories'] as const,
  settings: ['settings'] as const,
  promos: ['promos'] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  reservations: ['reservations'] as const,
  loyaltyLedger: ['loyaltyLedger'] as const,
};
