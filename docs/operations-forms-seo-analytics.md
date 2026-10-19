# Forms, SEO and analytics (static GitHub Pages build)

## Deployment model

- `deploy-pages.yml` builds and force-pushes `gh-pages` **only** on a push to `develop`
  (or a manual `workflow_dispatch`). Pull requests run `ci.yml` checks only.
- Nothing in this document deploys by itself.

## Contact and investor-relations forms

The forms in `resources/js/Components/ContactInquiryForm.jsx` and
`InvestorInquiryForm.jsx` render a mailto fallback until a build-time endpoint is set.

| Variable | Used by | Example value |
|---|---|---|
| `VITE_CONTACT_FORM_ENDPOINT` | Contact / Contacto | `https://formspree.io/f/<form-id>` or `https://formsubmit.co/<address>` |
| `VITE_IR_FORM_ENDPOINT` | Investor Relations / Relações com Investidores | as above |

The forms submit a native HTML `POST` with `_subject` and `_next` (thank-you page)
fields, so any relay that honours those fields works.

To enable (Founder approval required, production change):

1. Create the form(s) in the chosen service and confirm the receiving inbox.
2. Repository → Settings → Secrets and variables → Actions → add the two secrets.
3. Merge to `develop` (this triggers the production deploy).
4. Submit one test message per form and confirm delivery and the thank-you redirect.

Rollback: delete the secrets and re-run the deploy; the mailto fallback returns.

## SEO

`scripts/build-pages.mjs` writes, per route:

- `<title>` from the page's `MainLayout title` prop
- `<meta name="description">` from the first paragraph after the page `<h1>`
- `<link rel="canonical">`, EN/PT `hreflang` alternates, Open Graph and Twitter tags
- `noindex` on thank-you pages and `404.html`

It also writes `robots.txt` and `sitemap.xml` (thank-you pages excluded).

## Analytics (disabled by default)

| Variable | Effect |
|---|---|
| `VITE_CF_ANALYTICS_TOKEN` | Adds the Cloudflare Web Analytics beacon (cookieless). |
| `VITE_GA4_MEASUREMENT_ID` | Adds GA4 `gtag.js` (needs a consent decision first). |

Leave both unset to keep analytics off. No token is stored in the repository.
