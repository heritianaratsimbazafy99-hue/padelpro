"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { Button, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    setLoading(false);

    if (error) {
      setError(
        error.message.includes("rate limit") || error.message.includes("Too Many")
          ? "Trop de demandes. Patiente un instant avant de réessayer."
          : "Impossible d'envoyer le lien pour le moment. Réessaie dans quelques minutes.",
      );
      return;
    }

    setSent(true);
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
          {sent ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="size-14 rounded-2xl bg-lime/10 border border-lime/25 flex items-center justify-center">
                <MailCheck className="size-7 text-lime" aria-hidden />
              </div>
              <h1 className="text-xl font-extrabold">Vérifie ta boîte mail</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                Si un compte existe pour <strong className="text-ink">{email}</strong>, un lien de
                réinitialisation vient d&apos;être envoyé.
              </p>
              <Link href="/login" className="text-lime font-semibold text-sm hover:underline">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink mb-5"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Connexion
              </Link>
              <h1 className="text-xl font-extrabold mb-1">Réinitialise ton mot de passe</h1>
              <p className="text-sm text-ink-muted mb-6">
                Entre ton email et nous t&apos;enverrons un lien sécurisé pour choisir un nouveau mot de passe.
              </p>
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Field label="Email" htmlFor="email" error={error}>
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
                <Button type="submit" size="lg" full loading={loading}>
                  Envoyer le lien
                </Button>
              </form>
            </>
          )}
        </div>
        {!sent && (
          <p className="text-center text-sm text-ink-muted mt-5">
            Tu t&apos;en souviens ?{" "}
            <Link href="/login" className="text-lime font-semibold hover:underline">
              Se connecter
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
