"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Value = { label: string | null; setLabel: (label: string | null) => void };

const BreadcrumbContext = createContext<Value>({ label: null, setLabel: () => {} });

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const value = useMemo(() => ({ label, setLabel }), [label]);
  return <BreadcrumbContext value={value}>{children}</BreadcrumbContext>;
}

export const useBreadcrumbLabel = () => useContext(BreadcrumbContext).label;

// A detail page renders this so the last breadcrumb reads "CON-000016" instead of the raw id.
export function CrumbLabel({ label }: { label: string }) {
  const { setLabel } = useContext(BreadcrumbContext);
  useEffect(() => {
    setLabel(label);
    return () => setLabel(null);
  }, [label, setLabel]);
  return null;
}
