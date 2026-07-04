"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
      <Button type="submit" size="lg" full loading={loading}>
        Se connecter
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 court-grid">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <div className="bg-surface border border-border rounded-(--radius-card) p-6">
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
          <Link href="/signup" className="text-lime font-semibold hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
