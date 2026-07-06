import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAuthRedirectPath,
  validateNewPassword,
} from "./password-reset.ts";

describe("password reset auth helpers", () => {
  it("keeps auth redirects inside the app", () => {
    assert.equal(normalizeAuthRedirectPath("/auth/update-password"), "/auth/update-password");
    assert.equal(normalizeAuthRedirectPath("/login?confirmed=1"), "/login?confirmed=1");
    assert.equal(normalizeAuthRedirectPath("https://example.com/phishing"), "/dashboard");
    assert.equal(normalizeAuthRedirectPath("//example.com/phishing"), "/dashboard");
    assert.equal(normalizeAuthRedirectPath(null), "/dashboard");
  });

  it("validates the new password before calling Supabase", () => {
    assert.equal(
      validateNewPassword("court", "court"),
      "Le mot de passe doit contenir au moins 8 caractères.",
    );
    assert.equal(
      validateNewPassword("padelpro1", "padelpro2"),
      "Les deux mots de passe ne correspondent pas.",
    );
    assert.equal(validateNewPassword("padelpro1", "padelpro1"), null);
  });
});
