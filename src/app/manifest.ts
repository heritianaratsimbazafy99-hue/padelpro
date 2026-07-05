import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PadelPro — Americanos & tournois de padel",
    short_name: "PadelPro",
    description:
      "Organise des americanos, mexicanos et tournois de padel : rotations équitables, scores en direct, QR code, statistiques.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f3f0e6",
    theme_color: "#f3f0e6",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
