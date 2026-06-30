import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A full-bleed page band with a centered marketing container (DESIGN.md
 * hero-band / hero-band-dark / content-band). Surface contrast between
 * consecutive bands (sage → white → dark) is the Wise page rhythm.
 */
const bandVariants = cva("w-full px-6 py-12 md:py-16", {
  variants: {
    variant: {
      sage: "bg-canvas-soft text-foreground",
      white: "bg-card text-foreground",
      dark: "bg-ink text-primary",
    },
  },
  defaultVariants: {
    variant: "sage",
  },
});

function Band({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof bandVariants>) {
  return (
    <section className={cn(bandVariants({ variant }), className)} {...props}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export { Band, bandVariants };
