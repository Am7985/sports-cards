// app/ui/src/components/kit.tsx
import { HTMLAttributes, ReactNode } from "react";

export function PageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-4 pt-0 pb-6 space-y-4 ${className}`}>{children}</div>;
}

export function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative w-full md:w-80 ${className}`}>
      <span className="pointer-events-none absolute left-2 top-2.5 text-neutral-400">🔎</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 py-2 pl-7 pr-2 text-sm
                   placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
      />
    </div>
  );
}

export function ActionButton(
  props: HTMLAttributes<HTMLButtonElement> & { tone?: "default" | "primary" | "danger" }
) {
  const { className = "", tone = "default", ...rest } = props;
  const tones: Record<string, string> = {
    default: "border-neutral-700 bg-neutral-800 hover:bg-neutral-750",
    primary: "border-blue-600 bg-blue-600 hover:bg-blue-500",
    danger: "border-red-600 bg-red-600 hover:bg-red-500",
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${tones[tone]} ${className}`}
    />
  );
}

export function CardSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-neutral-800 bg-neutral-900 p-3 ${className}`}>{children}</div>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-neutral-800">{children}</div>;
}

export const th = "[&>th]:py-2 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium [&>th]:text-neutral-300";
export const td = "px-3 py-2";
