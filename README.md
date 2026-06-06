# AutoHouse.Dnepr Landing

Static landing page for AutoHouse.Dnepr with a Cloudflare Pages Function for the contact form.

## Cloudflare Pages deployment

Use Cloudflare Pages as the primary deployment target.

Cloudflare Pages settings:

- Framework preset: None
- Build command: `exit 0`
- Build output directory: `public`

Create these environment variables in Cloudflare Pages:

- `RESEND_API_KEY`
- `CONTACT_EMAIL`
- `FROM_EMAIL`
- `ALLOWED_ORIGIN`

The contact form endpoint is handled by `functions/api/contact.js` and is available at `/api/contact`.

`worker.js` and `wrangler.jsonc` are kept in the repository root as legacy backup files. They are not part of the `public` output directory.

Local static preview:

```sh
python -m http.server 8788 --directory public
```

Then open `http://127.0.0.1:8788/`. Do not open `public/index.html` directly as a file, because root-relative paths such as `/styles.css` require a web server whose root is `public`.

Post-deployment checklist:

- Main page opens.
- CSS and JS work.
- Images load.
- `/robots.txt` opens.
- `/sitemap.xml` opens.
- The form sends a `POST` request to `/api/contact`.
- The contact request arrives by email.
- `/firebase-key.json`, `/wp-login.php`, and `/xmlrpc.php` do not return HTTP 200.
