"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const confirmed = params.get("confirmed") === "1";
  const passwordUpdated = params.get("passwordUpdated") === "1";
  const authError = params.get("authError");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message.includes("Invalid login credentials")
          ? "Email ou mot de passe incorrect."
          : error.message,
      );
      setLoading(false);
      return;
    }
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {(confirmed || passwordUpdated || authError) && (
        <div
          role={authError ? "alert" : "status"}
          className={`flex gap-3 rounded-xl border p-3 text-sm ${
            authError
              ? "border-danger/25 bg-danger/10 text-danger"
              : "border-success/25 bg-success/10 text-success"
          }`}
        >
          {authError ? (
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>
            {authError
              ? "Le lien n'est plus valide. Demande un nouveau lien si besoin."
              : passwordUpdated
                ? "Mot de passe mis à jour. Connecte-toi avec le nouveau."
                : "Email confirmé. Tu peux maintenant te connecter."}
          </span>
        </div>
      )}
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.fr"
        />
      </Field>
      <Field label="Mot de passe" htmlFor="password" error={error}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>
      <div className="-mt-2 flex justify-end">
        <Link href="/forgot-password" className="text-sm font-semibold text-lime hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <Button type="submit" size="lg" full loading={loading}>
        Se connecter
      </Button>
    </form>
  );
}

export default function LoginPage() {
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
          <h1 className="text-xl font-extrabold mb-1">Content de te revoir</h1>
          <p className="text-sm text-ink-muted mb-6">
            Connecte-toi pour organiser ou suivre tes parties.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-center text-sm text-ink-muted mt-5">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="text-court font-semibold hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
