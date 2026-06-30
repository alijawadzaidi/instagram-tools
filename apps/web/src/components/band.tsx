import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A full-bleed page band with a centered content container (nike/DESIGN.md).
 * Nike stacks flat sections at a 48px rhythm — white canvas, soft-cloud gray,
 * and ink (black) campaign/member blocks. No radius, no shadow.
 */
const bandVariants = cva("w-full px-6 py-12 md:py-16", {
  variants: {
    variant: {
      white: "bg-canvas text-ink",
      soft: "bg-soft-cloud text-ink",
      dark: "bg-ink text-canvas",
    },
  },
  defaultVariants: {
    variant: "white",
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
