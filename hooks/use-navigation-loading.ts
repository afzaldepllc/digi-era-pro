"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export function useNavigationLoading() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigation = useCallback(
    (path: string) => {
      setIsNavigating(true);
      // Add a small delay to ensure the loading state is visible
      setTimeout(() => {
        router.push(path);
        // Reset the loading state after navigation
        setTimeout(() => setIsNavigating(false), 250);
      }, 100);
    },
    [router]
  );

  return {
    isNavigating,
    handleNavigation,
  };
}