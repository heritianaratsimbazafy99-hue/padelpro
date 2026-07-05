"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "btn-shine bg-lime text-on-lime font-bold hover:bg-lime-deep hover:shadow-[0_0_28px_-6px_rgba(200,245,66,0.5)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none",
  secondary:
    "bg-surface-3 text-ink font-semibold hover:bg-border-strong hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-40",
  ghost:
    "bg-transparent text-ink-muted font-semibold hover:text-ink hover:bg-surface-2 active:scale-[0.98] disabled:opacity-40",
  danger:
    "bg-danger/10 text-danger font-semibold border border-danger/30 hover:bg-danger/20 active:scale-[0.98] disabled:opacity-40",
  outline:
    "bg-transparent text-ink font-semibold border border-border-strong hover:border-lime hover:text-lime hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-40",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 text-[0.9375rem] rounded-xl gap-2",
  lg: "h-13 px-6 text-base rounded-2xl gap-2 min-h-[3.25rem]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, full, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center cursor-pointer select-none transition-all duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
        buttonVariants[variant],
        buttonSizes[size],
        full && "w-full",
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

/* ---------- Card ---------- */

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "bg-surface border border-border rounded-(--radius-card) p-4",
        onClick && "cursor-pointer card-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Inputs ---------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        "w-full h-12 px-4 rounded-(--radius-field) bg-surface-2 border border-border text-ink placeholder:text-ink-faint",
        "transition-colors duration-150 focus:outline-none focus:border-lime/60 focus:ring-2 focus:ring-lime/15",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cx(
        "w-full min-h-24 px-4 py-3 rounded-(--radius-field) bg-surface-2 border border-border text-ink placeholder:text-ink-faint resize-y",
        "transition-colors duration-150 focus:outline-none focus:border-lime/60 focus:ring-2 focus:ring-lime/15",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cx(
        "w-full h-12 px-4 rounded-(--radius-field) bg-surface-2 border border-border text-ink appearance-none cursor-pointer",
        "transition-colors duration-150 focus:outline-none focus:border-lime/60 focus:ring-2 focus:ring-lime/15",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cx("flex p-1 bg-surface-2 border border-border rounded-xl gap-1", className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cx(
            "flex-1 h-10 px-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150",
            value === opt.value
              ? "bg-lime text-on-lime"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Stepper (number +/-) ---------- */

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`Réduire ${label}`}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="size-11 rounded-xl bg-surface-2 border border-border text-ink text-xl font-bold cursor-pointer transition-colors hover:border-border-strong disabled:opacity-30 disabled:cursor-default"
      >
        −
      </button>
      <span className="tnum min-w-12 text-center text-2xl font-extrabold">{value}</span>
      <button
        type="button"
        aria-label={`Augmenter ${label}`}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className="size-11 rounded-xl bg-surface-2 border border-border text-ink text-xl font-bold cursor-pointer transition-colors hover:border-border-strong disabled:opacity-30 disabled:cursor-default"
      >
        +
      </button>
    </div>
  );
}

/* ---------- Badge ---------- */

type BadgeTone = "lime" | "muted" | "success" | "danger" | "warning" | "info";

const badgeTones: Record<BadgeTone, string> = {
  lime: "bg-lime/10 text-lime border-lime/25",
  muted: "bg-surface-2 text-ink-muted border-border",
  success: "bg-success/10 text-success border-success/25",
  danger: "bg-danger/10 text-danger border-danger/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  info: "bg-info/10 text-info border-info/25",
};

export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Avatar (initials) ---------- */

const avatarPalette = [
  "bg-lime/20 text-lime",
  "bg-info/20 text-info",
  "bg-success/20 text-success",
  "bg-warning/20 text-warning",
  "bg-danger/20 text-danger",
  "bg-purple-400/20 text-purple-300",
];

export function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const palette = avatarPalette[Math.abs(hash) % avatarPalette.length];
  const sizes = { sm: "size-7 text-[0.625rem]", md: "size-9 text-xs", lg: "size-12 text-sm" };
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex items-center justify-center rounded-full font-bold shrink-0",
        palette,
        sizes[size],
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ---------- Spinner / loading ---------- */

export function PageLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-ink-muted" role="status">
      <div className="flex flex-col items-center" aria-hidden>
        <span className="size-4 rounded-full bg-lime animate-ball-bounce shadow-[0_0_16px_rgba(200,245,66,0.5)]" />
        <span className="mt-1.5 h-1 w-6 rounded-full bg-lime/40 blur-[2px] animate-shadow-squash" />
      </div>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

/* ---------- Skeletons ---------- */

/** Bloc de chargement scintillant, à dimensionner via className. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton", className)} />;
}

/** Squelette d'une liste de cartes (événements, historique…). */
export function SkeletonList({ rows = 3, height = "h-20" }: { rows?: number; height?: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cx("w-full rounded-(--radius-card)", height)} />
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-14 px-6">
      {icon && (
        <div className="size-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-ink-faint animate-float">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="text-sm text-ink-muted max-w-xs leading-relaxed">{body}</p>}
      {action}
    </div>
  );
}
