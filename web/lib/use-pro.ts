"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ProStatus {
  isPro: boolean;
  isFounder: boolean;
  isAdmin: boolean;
  role: string;
  loading: boolean;
}

/**
 * Hook to check if current user has Pro access.
 *
 * Pro features:
 *   - Detailed narrative report (LLM-generated)
 *   - Score history & trends
 *   - PDF property report
 *   - Nursery recommendations with local availability
 *   - Priority plant identification
 *
 * Free features (never gated):
 *   - Scan & identify plants
 *   - Species census
 *   - YardScore (0-100)
 *   - Map with plant locations
 *   - Share link
 */
export function usePro(): ProStatus {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;
  const [status, setStatus] = useState<ProStatus>({
    isPro: false, isFounder: false, isAdmin: false, role: "free", loading: true,
  });

  useEffect(() => {
    if (!token) {
      setStatus((s) => ({ ...s, loading: false }));
      return;
    }
    apiFetch(token, `${API}/billing/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setStatus({
            isPro: d.is_pro || d.is_admin,
            isFounder: d.is_founder,
            isAdmin: d.is_admin,
            role: d.role,
            loading: false,
          });
        } else {
          setStatus((s) => ({ ...s, loading: false }));
        }
      })
      .catch(() => setStatus((s) => ({ ...s, loading: false })));
  }, [token]);

  return status;
}
