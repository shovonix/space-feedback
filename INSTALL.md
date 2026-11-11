# Space Feedback — setup

One small Node service (no dependencies) for every Space app:

- `https://shovonix.dev/feedback/widget.js` — the form. Each app loads it and calls `SpaceFeedback.open({ app: 'Space Cam', version: '…' })`.
- `https://shovonix.dev/feedback/` — the private inbox (one password). Filter by app, mark read or done, delete.
- Optional: email each submission to `MAIL_TO` (set the `SMTP_…` lines). Off on shovonix.dev: feedback is read in the inbox only.

Data: `DATA_DIR/<id>/meta.json` plus the attached files. Nothing is public: files are served only to a logged-in inbox.

## Local test (Mac)

```bash
cd ~/Sites/space/space-feedback
node set-password.js            # put the printed line into .env
```

`.env` (not in git):

```
PUBLIC_URL=http://localhost:8788/feedback
HOST=127.0.0.1
ALLOWED_ORIGINS=http://localhost:8000
ADMIN_PASS_HASH=scrypt$…
```

`node server.js`, then open http://localhost:8788/feedback/. Space Cam on http://localhost:8000 uses the local service automatically.

## VPS (once)

1. System user and folders (as root):

   ```bash
   useradd --system --no-create-home --shell /usr/sbin/nologin spacefeedback
   mkdir -p /opt/space-feedback /var/lib/space-feedback
   chown spacefeedback: /var/lib/space-feedback && chmod 700 /var/lib/space-feedback
   ```

   Copy `server.js`, `widget.js`, `inbox.html`, `inbox.js`, `login.html`, `set-password.js` into `/opt/space-feedback/` (root-owned, readable).

2. Password: `node /opt/space-feedback/set-password.js` (Shovon types it).

3. Email: Gmail → Google Account → Security → 2-Step Verification → App passwords → make one for "Space feedback" (Shovon does this).

4. `/etc/space-feedback.env` (root:spacefeedback, mode 640):

   ```
   PUBLIC_URL=https://shovonix.dev/feedback
   DATA_DIR=/var/lib/space-feedback
   ADMIN_PASS_HASH=scrypt$…
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=<the Gmail address>
   SMTP_PASS=<the app password>
   MAIL_TO=<the Gmail address>
   ```

   Any `https://*.shovonix.dev` page may send; add others with `ALLOWED_ORIGINS=` (comma separated).

5. `/etc/systemd/system/space-feedback.service`:

   ```ini
   [Unit]
   Description=Space Feedback
   After=network.target

   [Service]
   User=spacefeedback
   EnvironmentFile=/etc/space-feedback.env
   ExecStart=/usr/bin/node /opt/space-feedback/server.js
   Restart=on-failure
   NoNewPrivileges=true
   ProtectSystem=strict
   ReadWritePaths=/var/lib/space-feedback
   ProtectHome=true
   PrivateTmp=true

   [Install]
   WantedBy=multi-user.target
   ```

   `systemctl daemon-reload && systemctl enable --now space-feedback`

6. CloudPanel → shovonix.dev → Vhost, inside `server { … }` for 443:

   ```nginx
   location = /feedback { return 301 /feedback/; }
   location ^~ /feedback/ {
     client_max_body_size 110m;
     proxy_request_buffering off;
     proxy_read_timeout 600s;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_pass http://127.0.0.1:8788;
   }
   ```

7. Check: `curl -sI https://shovonix.dev/feedback/widget.js` → 200. Open the inbox, log in, send a test from Space Cam, look for the email.

## Updating

Copy the changed files to `/opt/space-feedback/`, then `systemctl restart space-feedback`. Data stays in `/var/lib/space-feedback`.

## Backup

`/var/lib/space-feedback` holds everything (feedback + files). `tar czf` it now and then.
