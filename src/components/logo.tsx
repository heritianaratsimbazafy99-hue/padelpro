import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="var(--lime)" />
      {/* padel racket */}
      <circle cx="17" cy="16" r="8" fill="none" stroke="#0a0f04" strokeWidth="2.6" />
      <line x1="22.5" y1="21.5" x2="28" y2="27" stroke="#0a0f04" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="14.5" cy="13.5" r="1.15" fill="#0a0f04" />
      <circle cx="19.5" cy="13.5" r="1.15" fill="#0a0f04" />
      <circle cx="14.5" cy="18.5" r="1.15" fill="#0a0f04" />
      <circle cx="19.5" cy="18.5" r="1.15" fill="#0a0f04" />
      {/* ball */}
      <circle cx="30" cy="12" r="3.4" fill="#0a0f04" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      <LogoMark />
      <span className="text-lg font-extrabold tracking-tight">
        Padel<span className="text-lime">Pro</span>
      </span>
    </Link>
  );
}
