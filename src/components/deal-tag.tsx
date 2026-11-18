import type { Deal } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { tagText } from "@/lib/deal-text";

/** The swing tag: the saving, and what it's measured against. */
export function DealTag({ deal, size = "md", className }: { deal: Deal; size?: "md" | "lg"; className?: string }) {
  const { big, small } = tagText(deal);
  return (
    <span className={cn("deal-tag", className)}>
      <span className={cn("price leading-none", size === "lg" ? "text-4xl" : "text-2xl")}>{big}</span>
      <span className={cn("font-medium", size === "lg" ? "text-sm" : "text-xs")}>{small}</span>
    </span>
  );
}
