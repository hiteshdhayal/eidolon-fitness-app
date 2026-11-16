# Deploying Eidolon

A from-scratch runbook for a single Ubuntu LTS VPS. Everything here is a one-time setup except "Deploying a new release", which you'll run on every push.

Nothing in this repo can provision a real server for you — these are the configs and scripts to run *on* one you control. No VPS, DNS or secrets exist yet; this document is what makes them real.

## What you need before starting

- A VPS running Ubuntu 22.04 or 24.04 LTS, with root (or sudo) SSH access. 1 vCPU / 1 GB RAM is enough — the site is static files and Umami is the only thing that actually computes anything.
- A domain you control: `eidolon.cloud` (the real value from `SPEC.md` §24 and `src/config/site.ts`).
- An SSH key pair on the machine you'll deploy from (your laptop or CI).

## 1. DNS

At your DNS provider, point these at the VPS's IPv4 (and IPv6, if you have one):

| Type | Host | Value |
| --- | --- | --- |
| A | `eidolon.cloud` | `<vps-ip>` |
| A | `www.eidolon.cloud` | `<vps-ip>` |
| A | `stats.eidolon.cloud` | `<vps-ip>` |

Give it a few minutes to propagate before running certbot in step 4 — it validates ownership over HTTP.

## 2. Server hardening

SSH in as root once, then do all of this:

```bash
# A non-root user to deploy and SSH in as from now on.
adduser deploy
usermod -aG sudo deploy

# Copy your public key over instead of a password.
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Firewall: only SSH, HTTP and HTTPS.
apt update && apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Brute-force protection on SSH.
apt install -y fail2ban
systemctl enable --now fail2ban

# Unattended security patches.
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

Then, still as root, disable password SSH auth and root login in `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PermitRootLogin no
```

`systemctl restart sshd`. From here on, SSH in as `deploy@eidolon.cloud` only — confirm that works in a second terminal **before** closing the root session.

## 3. Install Nginx, Node (for local builds only), Docker and Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx docker.io docker-compose-plugin
systemctl enable --now nginx docker
usermod -aG docker deploy
```

(Node/pnpm are not needed on the server — `scripts/deploy.sh` builds locally or in CI and rsyncs the finished `dist/` over. The server only ever serves static files and runs the Umami container.)

Optional: install `ngx_brotli` for smaller responses than gzip alone (Ubuntu's stock nginx package doesn't include it). Skip this on first deploy — gzip in `deploy/nginx.conf` already covers compression; add brotli later if you want it.

## 4. Release directory layout

```bash
mkdir -p /var/www/eidolon.cloud/releases
chown -R deploy:deploy /var/www/eidolon.cloud
```

`scripts/deploy.sh` creates everything else (`releases/<timestamp>/`, the `current` symlink) on each run.

## 5. Nginx + TLS

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/eidolon.cloud
ln -s /etc/nginx/sites-available/eidolon.cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

At this point there's no `current` symlink yet, so nginx will 404 on `/` — that's expected until step 7's first deploy. Now get certificates (DNS from step 1 must already be live):

```bash
certbot --nginx -d eidolon.cloud -d www.eidolon.cloud -d stats.eidolon.cloud
```

Certbot edits `/etc/nginx/sites-available/eidolon.cloud` in place to add the `listen 443 ssl` directives, certificate paths, and the HTTP→HTTPS redirect — that's why `deploy/nginx.conf` ships without them. Certbot's systemd timer renews automatically; confirm it's active with `systemctl list-timers | grep certbot`.

Access-log retention: `/privacy/` promises server logs are kept 14 days, then deleted automatically.

```bash
cp deploy/logrotate-eidolon /etc/logrotate.d/eidolon
```

logrotate's own daily timer picks this up — nothing else to run. Verify any time with `logrotate -d /etc/logrotate.d/eidolon` (dry run).

## 6. Umami (self-hosted analytics)

```bash
mkdir -p /opt/eidolon/umami
cp deploy/umami/docker-compose.yml /opt/eidolon/umami/
cp deploy/umami/.env.example /opt/eidolon/umami/.env
```

Edit `/opt/eidolon/umami/.env` and fill in both secrets:

```bash
# Database password — any long random string.
openssl rand -hex 32
# APP_SECRET — Umami's session-signing key.
openssl rand -hex 32
```

```bash
cd /opt/eidolon/umami
docker compose up -d
```

Umami listens on `127.0.0.1:3001`; nginx (already configured in step 5) proxies `https://stats.eidolon.cloud` to it. Visit it, create the admin account, then add a website for `eidolon.cloud` — Umami gives you a **website ID** (a UUID), not a domain.

Set that ID in `src/config/site.ts`'s `umamiWebsiteId` and redeploy (step 7). Until that field is filled in, the tracking script never loads and nothing is sent from any visitor's browser — this is intentional (see `README.md`'s "Site config" section), not a bug to work around.

## 7. Deploying a new release

From your local machine or CI (**not** the server):

```bash
scripts/deploy.sh deploy@eidolon.cloud
```

This runs `pnpm build` (which itself runs the full guard chain — placeholders, links, SEO, images, JS budget, a11y structure, copy — see `README.md`), rsyncs `dist/` to a new timestamped release directory, then atomically swaps the `current` symlink to point at it. The previous 4 releases are kept; anything older is pruned.

Set `DEPLOY_HOST=deploy@eidolon.cloud` in your shell or CI secrets to drop the argument.

### Rolling back

```bash
scripts/rollback.sh deploy@eidolon.cloud
```

Points `current` at whichever release directory isn't the one it's pointing at now, picking the most recent of those. This is a symlink swap, not a rebuild — instant, and safe to run even if the last deploy's build itself was fine but something about the content was wrong.

## 8. First deploy checklist

Run through `docs/LAUNCH-CHECKLIST.md` before the first real deploy — it covers the content and copy decisions that are still open (About copy, hero photos, draft content, food review sign-off, legal review). None of it blocks `scripts/deploy.sh` from working; it's what makes the site *correct*, not what makes it *run*.

## What this doesn't cover

- **CI.** `scripts/deploy.sh` is written to run from a laptop or a CI job with SSH access to the server — wiring up the actual CI trigger (GitHub Actions, etc.) is a separate, later decision, not part of this phase.
- **Backups.** The only state on the server that isn't reproducible from this repo is the Umami Postgres volume (`umami-db-data`). Back it up with `docker compose exec db pg_dump -U umami umami > backup.sql` on whatever schedule you want; losing it loses analytics history, not the site itself.
- **Monitoring/uptime alerts.** Not in SPEC.md's scope for this phase.
