"use client";

import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "btn-shine bg-court text-cream font-bold hover:bg-court-2 hover:shadow-club-lg hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none",
  secondary:
    "bg-surface-2 text-ink font-semibold border border-border hover:border-border-strong hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-40",
  ghost:
    "bg-transparent text-ink-muted font-semibold hover:text-ink hover:bg-surface-2 active:scale-[0.98] disabled:opacity-40",
  danger:
    "bg-danger/10 text-danger font-semibold border border-danger/30 hover:bg-danger/20 active:scale-[0.98] disabled:opacity-40",
  outline:
    "bg-surface text-ink font-semibold border border-border-strong hover:border-court hover:text-court hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-40",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm rounded-full gap-1.5",
  md: "h-11 px-6 text-[0.9375rem] rounded-full gap-2",
  lg: "h-13 px-7 text-base rounded-full gap-2 min-h-[3.25rem]",
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
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court",
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
        "bg-surface border border-border rounded-(--radius-card) p-4 shadow-club",
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
        "transition-colors duration-150 focus:outline-none focus:border-court/50 focus:ring-2 focus:ring-court/15",
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
        "transition-colors duration-150 focus:outline-none focus:border-court/50 focus:ring-2 focus:ring-court/15",
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
        "transition-colors duration-150 focus:outline-none focus:border-court/50 focus:ring-2 focus:ring-court/15",
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
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      role="radiogroup"
      className={cx("relative flex p-1 bg-surface-2 border border-border rounded-xl", className)}
    >
      {/* Pilule active : glisse d'un onglet à l'autre */}
      {index >= 0 && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-1 rounded-lg bg-lime shadow-club transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
      )}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cx(
            "relative z-10 flex-1 h-10 px-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-200 active:scale-[0.97]",
            value === opt.value ? "text-on-lime" : "text-ink-muted hover:text-ink",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- PopValue (pop du chiffre quand la valeur change) ---------- */

/**
 * Affiche une valeur qui « pope » (scale + flash terracotta) à chaque
 * changement APRÈS le montage — aucun effet au premier rendu, pour ne pas
 * faire clignoter les listes au chargement.
 */
export function PopValue({ value, className }: { value: ReactNode; className?: string }) {
  const [prev, setPrev] = useState(value);
  const [gen, setGen] = useState(0);
  if (prev !== value) {
    setPrev(value);
    setGen((g) => g + 1);
  }
  return (
    <span key={gen} className={cx("inline-block", gen > 0 && "animate-score-pop", className)}>
      {value}
    </span>
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
        className="size-11 rounded-xl bg-surface-2 border border-border text-ink text-xl font-bold cursor-pointer transition-all hover:border-border-strong active:scale-95 disabled:opacity-30 disabled:cursor-default"
      >
        −
      </button>
      <PopValue value={value} className="tnum min-w-12 text-center text-2xl font-extrabold" />
      <button
        type="button"
        aria-label={`Augmenter ${label}`}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className="size-11 rounded-xl bg-surface-2 border border-border text-ink text-xl font-bold cursor-pointer transition-all hover:border-border-strong active:scale-95 disabled:opacity-30 disabled:cursor-default"
      >
        +
      </button>
    </div>
  );
}

/* ---------- Badge ---------- */

type BadgeTone = "lime" | "muted" | "success" | "danger" | "warning" | "info";

const badgeTones: Record<BadgeTone, string> = {
  lime: "bg-lime/40 text-court border-lime-deep/50",
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

/* ---------- Avatar (photo ou initiales) ---------- */

const avatarPalette = [
  "bg-lime/50 text-court",
  "bg-info/20 text-info",
  "bg-success/20 text-success",
  "bg-warning/20 text-warning",
  "bg-danger/20 text-danger",
  "bg-purple-400/20 text-purple-800",
];

export function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  /** Photo de profil ; à défaut, initiales colorées. */
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const palette = avatarPalette[Math.abs(hash) % avatarPalette.length];
  const sizes = {
    sm: "size-7 text-[0.625rem]",
    md: "size-9 text-xs",
    lg: "size-12 text-sm",
    xl: "size-24 text-2xl",
  };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique
      <img
        src={src}
        alt={`Photo de ${name}`}
        className={cx("rounded-full object-cover shrink-0 bg-surface-2", sizes[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex items-center justify-center rounded-full font-bold shrink-0",
        palette,
        sizes[size],
        className,
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

/* ---------- Toast (feedback éphémère) ---------- */

export interface ToastData {
  message: string;
  tone?: "success" | "danger";
}

/**
 * Toast éphémère : confirme une action (optimistic UI) ou signale une erreur.
 * S'auto-détruit ; le parent le retire via onDone.
 */
export function Toast({ toast, onDone }: { toast: ToastData; onDone: () => void }) {
  const danger = toast.tone === "danger";
  useEffect(() => {
    const t = setTimeout(onDone, danger ? 4500 : 2200);
    return () => clearTimeout(t);
  }, [danger, toast, onDone]);

  return (
    <div
      role={danger ? "alert" : "status"}
      className="fixed bottom-24 inset-x-0 z-[70] flex justify-center px-4 pointer-events-none"
    >
      <div
        key={toast.message}
        className={cx(
          "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-club-lg animate-scale-in",
          danger ? "bg-danger text-white" : "bg-court text-cream",
        )}
      >
        {danger ? (
          <XCircle className="size-4 shrink-0" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-lime" aria-hidden />
        )}
        {toast.message}
      </div>
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
    <div className="flex flex-col items-center text-center gap-3 py-14 px-6 animate-scale-in">
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
