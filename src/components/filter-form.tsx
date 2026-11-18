"use client";

import Form from "next/form";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * The deals page's filter form. A plain GET form, so filtering works without JavaScript;
 * with it, ticking a box or changing a select submits straight away. Text fields submit
 * on Enter (the native change event fires on commit, not on every keystroke).
 */
export function FilterForm({ children, id }: { children: ReactNode; id: string }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const onChange = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      if (target instanceof HTMLInputElement && (target.type === "search" || target.type === "text")) return;
      form.requestSubmit();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);
  return (
    <Form ref={ref} action="/" id={id} scroll={false}>
      {children}
    </Form>
  );
}
