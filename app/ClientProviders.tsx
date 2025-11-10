"use client";

import { SessionProvider } from "next-auth/react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeVariantProvider } from "@/components/theme-variant-provider";
import { ProfessionalSessionProvider } from "@/components/providers/professional-session-provider";
import { NavigationProvider } from "@/components/providers/navigation-provider";
import { NavigationLoadingBar } from "@/components/ui/navigation-loading-bar";
import { store } from "@/store";
import dynamic from "next/dynamic";
import { memo, useMemo } from "react";

// Lazy load non-essential components for fast initial load
const Toaster = dynamic(() => import("@/components/ui/toaster").then(mod => ({ default: mod.Toaster })), {
  ssr: false,
  loading: () => null,
});

// Create QueryClient outside component to prevent recreation on every render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false, // Reduce network overhead
    },
  },
});

export default memo(function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider 
      refetchInterval={0} 
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeVariantProvider>
            <ProfessionalSessionProvider>
              <NavigationProvider>
                <NavigationLoadingBar />
                {children}
                <Toaster />
              </NavigationProvider>
            </ProfessionalSessionProvider>
          </ThemeVariantProvider>
        </QueryClientProvider>
      </Provider>
    </SessionProvider>
  );
});