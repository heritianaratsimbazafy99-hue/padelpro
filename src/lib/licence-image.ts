import type { PreferredSide } from "./types";
import { SIDE_LABELS } from "./utils";

/**
 * Export de la carte licence en PNG (1080×1080) pour partage WhatsApp /
 * réseaux : dessin canvas aux couleurs du club, puis Web Share API si
 * disponible, sinon téléchargement direct.
 */
export interface LicenceData {
  name: string;
  title: string;
  elo: number | null;
  avatarUrl: string | null;
  initials: string;
  bio: string | null;
  side: PreferredSide | null;
  racket: string | null;
  memberSince: number | null;
  trophies: { unlocked: number; total: number };
}

/* Palette « Club Éditorial » (voir globals.css) */
const COURT = "#14351f";
const COURT_LINE = "rgba(200, 245, 66, 0.16)";
const LIME = "#c8f542";
const CREAM = "#f3f0e6";
const MUTED = "#b9c4a8";

function cssFont(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Coupe un texte en lignes tenant dans maxWidth (au plus maxLines). */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width <= maxWidth) {
      line = probe;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

async function drawLicence(data: LicenceData): Promise<HTMLCanvasElement> {
  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  const display = cssFont("--font-display", "system-ui, sans-serif");
  const sans = cssFont("--font-sans", "system-ui, sans-serif");
  const serif = cssFont("--font-serif", "Georgia, serif");

  /* Fond vert court + lignes de terrain stylisées */
  ctx.fillStyle = COURT;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = COURT_LINE;
  ctx.lineWidth = 3;
  ctx.strokeRect(70, 70, S - 140, S - 140);
  ctx.beginPath();
  ctx.moveTo(70, S / 2);
  ctx.lineTo(S - 70, S / 2);
  ctx.moveTo(S / 2, 70);
  ctx.lineTo(S / 2, S - 70);
  ctx.stroke();

  /* Kicker + titre de licence */
  ctx.fillStyle = LIME;
  ctx.font = `bold 30px ${sans}`;
  ctx.textAlign = "center";
  const kicker = `LICENCE PADELPRO — ${data.title.toUpperCase()}`;
  ctx.fillText(kicker.split("").join(" "), S / 2, 150);

  /* Avatar rond centré, anneau lime */
  const cx = S / 2;
  const cy = 340;
  const r = 130;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (data.avatarUrl) {
    try {
      const img = await loadImage(data.avatarUrl);
      const side = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        cx - r,
        cy - r,
        r * 2,
        r * 2,
      );
    } catch {
      data = { ...data, avatarUrl: null };
    }
  }
  if (!data.avatarUrl) {
    ctx.fillStyle = "#235234";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = LIME;
    ctx.font = `bold 96px ${display}`;
    ctx.textBaseline = "middle";
    ctx.fillText(data.initials, cx, cy + 8);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 8;
  ctx.stroke();

  /* Nom */
  ctx.fillStyle = CREAM;
  ctx.font = `bold 78px ${display}`;
  ctx.fillText(data.name, S / 2, 580, S - 200);

  /* Elo + membre depuis */
  ctx.fillStyle = LIME;
  ctx.font = `bold 108px ${display}`;
  ctx.fillText(data.elo === null ? "—" : String(data.elo), S / 2, 700);
  ctx.fillStyle = MUTED;
  ctx.font = `bold 28px ${sans}`;
  const sub = [
    "ELO",
    data.memberSince ? `Membre depuis ${data.memberSince}` : null,
    `${data.trophies.unlocked}/${data.trophies.total} trophées`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  ctx.fillText(sub, S / 2, 748);

  /* Chips côté / raquette */
  const chips = [data.side ? SIDE_LABELS[data.side] : null, data.racket].filter(
    (c): c is string => !!c,
  );
  if (chips.length) {
    ctx.font = `600 30px ${sans}`;
    const padX = 28;
    const gap = 20;
    const widths = chips.map((c) => ctx.measureText(c).width + padX * 2);
    let x = S / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1)) / 2;
    for (let i = 0; i < chips.length; i++) {
      ctx.fillStyle = "rgba(243, 240, 230, 0.1)";
      ctx.beginPath();
      ctx.roundRect(x, 790, widths[i], 60, 30);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.fillText(chips[i], x + widths[i] / 2, 830);
      x += widths[i] + gap;
    }
  }

  /* Bio en serif italique */
  if (data.bio) {
    ctx.fillStyle = MUTED;
    ctx.font = `italic 34px ${serif}`;
    const lines = wrapText(ctx, `« ${data.bio} »`, S - 260, 2);
    lines.forEach((l, i) => ctx.fillText(l, S / 2, 910 + i * 44));
  }

  /* Signature */
  ctx.fillStyle = LIME;
  ctx.font = `bold 34px ${display}`;
  ctx.fillText("PadelPro", S / 2, S - 60);

  return canvas;
}

/** Génère le PNG puis partage (Web Share API) ou télécharge. */
export async function shareLicence(data: LicenceData): Promise<"shared" | "downloaded"> {
  const canvas = await drawLicence(data);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("encode_failed");
  const file = new File([blob], "licence-padelpro.png", { type: "image/png" });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Licence PadelPro — ${data.name}` });
      return "shared";
    } catch (e) {
      // L'utilisateur a annulé le partage : ne pas basculer sur le téléchargement.
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "licence-padelpro.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
