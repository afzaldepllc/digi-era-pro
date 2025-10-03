"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only show loader for slower operations
    setIsLoading(true);

    // Much faster loading timeout
    const timeout = setTimeout(() => setIsLoading(false), 150);

    return () => {
      clearTimeout(timeout);
    };
  }, [pathname, searchParams]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="loader" />
    </div>
  );
}