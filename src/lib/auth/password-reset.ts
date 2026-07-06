export function normalizeAuthRedirectPath(value: string | null, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://padelpro.local");
    if (url.origin !== "https://padelpro.local") {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function validateNewPassword(password: string, confirmPassword: string) {
  if (password.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (password !== confirmPassword) {
    return "Les deux mots de passe ne correspondent pas.";
  }
  return null;
}
