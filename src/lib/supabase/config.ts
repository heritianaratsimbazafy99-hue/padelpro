/**
 * Configuration Supabase. La clé "publishable" est conçue pour être exposée
 * côté client (la sécurité repose sur RLS) ; le fallback garantit un
 * déploiement fonctionnel même sans variables d'environnement.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://pktzbwhsugtcdduxjgfu.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_vEc7kGEtJ2am_rkqIJDM7g_YTyRqT85";
