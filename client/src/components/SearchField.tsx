import { useId } from "react";
import searchIcon from "../assets/icons/icon-search.svg";
import { MaskIcon } from "./MaskIcon";

export function SearchField({
  value,
  onChange,
  label,
  placeholder = "Search by name or email",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex w-80 items-center gap-3 rounded-md border border-black-700 bg-black-950 px-4 py-3 focus-within:border-gold-400 focus-within:ring-1 focus-within:ring-gold-400">
      <MaskIcon src={searchIcon} className="size-5 text-gold-400" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-body-md text-ink outline-none placeholder:text-gold-muted"
      />
    </div>
  );
}
