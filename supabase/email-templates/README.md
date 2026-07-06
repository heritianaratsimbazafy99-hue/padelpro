# Supabase Auth email templates

Source locale des templates configures dans Supabase Auth.

## Templates actifs

| Template Supabase | Sujet | Fichier |
| --- | --- | --- |
| `confirmation` | `Confirme ton adresse email` | `confirmation.html` |
| `recovery` | `Réinitialise ton mot de passe` | `recovery.html` |

L'application utilise `supabase.auth.signUp()` avec confirmation email et `supabase.auth.resetPasswordForEmail()` pour la reinitialisation de mot de passe. Les templates `invite`, `magic_link`, `email_change` et `reauthentication` ne sont donc pas personnalises tant que les parcours correspondants ne sont pas exposes dans l'app.

La direction visuelle suit les tokens de l'app `Club Editorial` :

- fond papier creme `#f3f0e6`
- surface `#fbf9f2`
- bordures `#ddd7c2`
- texte `#14210f`
- CTA lime `#c8f542`
- accent terracotta `#e8582f`
- pile typo email : `Plus Jakarta Sans`, `Space Grotesk`, puis fallbacks systeme

Les liens des templates actifs utilisent le flux PKCE recommande pour SSR :

- `confirmation` : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
- `recovery` : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`

## Configuration SMTP Resend

Supabase Auth doit utiliser le SMTP Resend :

```txt
Host: smtp.resend.com
Port: 465
Username: resend
Password: <Resend API key>
Sender name: PadelPro
```

La cle Resend ne doit pas etre stockee dans le depot. Elle vit uniquement dans la configuration SMTP Supabase.
