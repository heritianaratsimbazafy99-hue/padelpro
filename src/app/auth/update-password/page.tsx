"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, ShieldAlert } from "lucide-react";
import { validateNewPassword } from "@/lib/auth/password-reset";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { Button, Field, Input } from "@/components/ui";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.user));
      setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateNewPassword(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("Impossible de changer le mot de passe. Demande un nouveau lien et réessaie.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setUpdated(true);
    setLoading(false);
    router.push("/login?passwordUpdated=1");
    router.refresh();
  }

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-10 court-grid glow-scene overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -translate-x-1/2 size-96 rounded-full bg-lime/10 blur-[100px] pointer-events-none"
      />
      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <div className="gradient-border rounded-(--radius-card) p-6">
          {checkingSession ? (
            <div className="flex flex-col items-center text-center gap-3 py-5">
              <div className="size-14 rounded-2xl bg-lime/10 border border-lime/25 flex items-center justify-center">
                <KeyRound className="size-7 text-lime animate-pulse" aria-hidden />
              </div>
              <p className="text-sm text-ink-muted">Vérification du lien sécurisé...</p>
            </div>
          ) : !hasSession ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="size-14 rounded-2xl bg-danger/10 border border-danger/25 flex items-center justify-center">
                <ShieldAlert className="size-7 text-danger" aria-hidden />
              </div>
              <h1 className="text-xl font-extrabold">Lien expiré</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                Ce lien de réinitialisation n&apos;est plus valide. Demande un nouveau lien pour continuer.
              </p>
              <Link href="/forgot-password" className="text-lime font-semibold text-sm hover:underline">
                Demander un nouveau lien
              </Link>
            </div>
          ) : updated ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="size-14 rounded-2xl bg-success/10 border border-success/25 flex items-center justify-center">
                <CheckCircle2 className="size-7 text-success" aria-hidden />
              </div>
              <h1 className="text-xl font-extrabold">Mot de passe mis à jour</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                Tu peux maintenant te reconnecter avec ton nouveau mot de passe.
              </p>
            </div>
          ) : (
            <>
              <div className="size-12 rounded-2xl bg-lime/10 border border-lime/25 flex items-center justify-center mb-5">
                <KeyRound className="size-6 text-lime" aria-hidden />
              </div>
              <h1 className="text-xl font-extrabold mb-1">Choisis un nouveau mot de passe</h1>
              <p className="text-sm text-ink-muted mb-6">
                Utilise au moins 8 caractères. Nous te déconnecterons ensuite pour repartir sur une session propre.
              </p>
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Field label="Nouveau mot de passe" htmlFor="password" hint="8 caractères minimum.">
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
                <Field label="Confirmation" htmlFor="confirm-password" error={error}>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
                <Button type="submit" size="lg" full loading={loading}>
                  Mettre à jour
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
