"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/logo";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (error) {
      setError(
        error.message.includes("already registered")
          ? "Un compte existe déjà avec cet email."
          : error.message,
      );
      setLoading(false);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      // Confirmation d'email activée côté Supabase.
      setAwaitingConfirm(true);
      setLoading(false);
    }
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
          {awaitingConfirm ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="size-14 rounded-2xl bg-lime/10 border border-lime/25 flex items-center justify-center">
                <MailCheck className="size-7 text-court" aria-hidden />
              </div>
              <h1 className="text-xl font-extrabold">Vérifie ta boîte mail</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                Un lien de confirmation a été envoyé à <strong className="text-ink">{email}</strong>.
                Clique dessus puis connecte-toi.
              </p>
              <Link href="/login" className="text-court font-semibold text-sm hover:underline">
                Aller à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-extrabold mb-1">Crée ton compte joueur</h1>
              <p className="text-sm text-ink-muted mb-6">
                Organise des parties, suis tes stats, rejoins des tournois.
              </p>
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Field label="Nom affiché" htmlFor="name" hint="Visible sur les classements.">
                  <Input
                    id="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rafa N."
                  />
                </Field>
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
                <Field label="Mot de passe" htmlFor="password" error={error} hint="8 caractères minimum.">
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
                <Button type="submit" size="lg" full loading={loading}>
                  Créer mon compte
                </Button>
              </form>
            </>
          )}
        </div>
        {!awaitingConfirm && (
          <p className="text-center text-sm text-ink-muted mt-5">
            Déjà inscrit ?{" "}
            <Link href="/login" className="text-court font-semibold hover:underline">
              Se connecter
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
