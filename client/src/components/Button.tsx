import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "flex items-center justify-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50";

// Sizes follow the Figma Button component: primary is Lg, secondary and ghost are Md.
const variants: Record<Variant, string> = {
  primary: "bg-gold-metal px-8 py-4 font-display text-button-lg text-black-950",
  secondary: "border border-gold-500 px-6 py-3 font-display text-button-md text-gold-300",
  ghost: "px-6 py-3 font-display text-button-md text-ink",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button {...props} className={`${base} ${variants[variant]} ${className}`} />;
}
