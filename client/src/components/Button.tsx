import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`bg-gold-metal flex items-center justify-center rounded-full px-8 py-4 font-display text-button-lg text-black-950 outline-offset-2 focus-visible:outline-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}
