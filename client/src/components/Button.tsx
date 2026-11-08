import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "flex items-center justify-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-gold-metal font-display text-black-950",
  secondary: "border border-gold-500 font-display text-gold-300",
  ghost: "font-display text-ink",
};

// The Figma Button component has Md (nav, toolbars) and Lg (hero, CTA).
const sizes: Record<Size, string> = {
  md: "px-6 py-3 text-button-md",
  lg: "px-8 py-4 text-button-lg",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

/** Primary defaults to Lg (the login button); secondary and ghost default to Md. */
export function Button({
  variant = "primary",
  size = variant === "primary" ? "lg" : "md",
  className = "",
  ...props
}: ButtonProps) {
  return <button {...props} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} />;
}
