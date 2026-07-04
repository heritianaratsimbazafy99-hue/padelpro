"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Share2, X } from "lucide-react";
import { joinUrl } from "@/lib/utils";
import { Button } from "./ui";

/** Modale QR : les participants scannent pour rejoindre l'événement. */
export function QRShare({ shareCode, onClose }: { shareCode: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = joinUrl(shareCode);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Rejoins la partie de padel", url });
      } catch {
        /* partage annulé */
      }
    } else {
      copy();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Partager l'événement"
    >
      <button aria-label="Fermer" className="absolute inset-0 bg-black/70 cursor-pointer" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-3xl p-6 w-full max-w-sm text-center animate-fade-up">
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 size-10 rounded-xl flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors"
        >
          <X className="size-5" />
        </button>
        <h2 className="text-lg font-extrabold mb-1">Inviter les joueurs</h2>
        <p className="text-sm text-ink-muted mb-5">
          Scanne le QR code ou partage le lien : chaque joueur sélectionne son nom et peut annoncer
          les scores.
        </p>
        <div className="inline-block bg-white p-4 rounded-2xl mb-4 glow-lime">
          <QRCodeSVG value={url} size={200} marginSize={0} aria-label={`QR code vers ${url}`} />
        </div>
        <p className="tnum text-2xl font-extrabold tracking-[0.3em] text-lime mb-5">{shareCode}</p>
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={copy}>
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            {copied ? "Copié !" : "Copier le lien"}
          </Button>
          <Button full onClick={share}>
            <Share2 className="size-4" />
            Partager
          </Button>
        </div>
      </div>
    </div>
  );
}
