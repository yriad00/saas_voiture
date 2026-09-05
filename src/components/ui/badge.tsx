import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Enums } from "@/lib/database.types";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        secondary: "border-transparent bg-muted text-muted-foreground",
        success: "border-transparent bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
        warning: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
        destructive: "border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Map an agency status to a badge variant + label. */
const AGENCY_STATUS_META: Record<
  Enums<"agency_status">,
  { variant: BadgeProps["variant"]; label: string }
> = {
  ACTIVE: { variant: "success", label: "Active" },
  TRIAL: { variant: "default", label: "Trial" },
  INACTIVE: { variant: "secondary", label: "Inactive" },
  SUSPENDED: { variant: "warning", label: "Suspended" },
  EXPIRED: { variant: "destructive", label: "Expired" },
};

function AgencyStatusBadge({ status }: { status: Enums<"agency_status"> }) {
  const meta = AGENCY_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

/** Generic status badge driven by a {label, variant} map entry (see @/lib/labels). */
function StatusBadge({ meta }: { meta: { label: string; variant: BadgeProps["variant"] } }) {
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export { Badge, badgeVariants, AgencyStatusBadge, StatusBadge };
