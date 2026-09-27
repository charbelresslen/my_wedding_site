# Putting the site online for real guests

*Deploying to a Windows server or VM instead? See [DEPLOY-WINDOWS.md](DEPLOY-WINDOWS.md) — same three pieces, same
reasoning, Windows' own tools (IIS, NSSM, `winget`) instead of `apt`/Nginx/`systemctl`.*

Right now everything runs on your own computer: the site (`npm start`, port 4200), the small API in `server/`
(port 3010), and MySQL. That is why a phone on your own Wi-Fi could reach it once `--host 0.0.0.0` was used, but a
guest anywhere else on the internet cannot - your computer is not a public address, and it is not always turned on.

There are three things to put somewhere public: the site's files, the small API, and the database. This guide sets
up all three **on one small server**, which is the simplest way to do it: one bill, one place to look after, and -
because the site and the API then live under the *same* address, reached through Nginx - the browser never needs
cross-origin permission (CORS) for the RSVP form to talk to the API. That one thing DOES need a one-line change:
open `src/app/rsvp/rsvp.ts` and set `SAME_ORIGIN = true` (it defaults to `false`, which asks for the API at its own
port instead - correct for testing, and for the simpler VM setup below, but not for this same-address Nginx setup).

**Already have a VM instead, and just want it reachable at its own address and port, with no domain or Nginx?** That
is simpler: keep `SAME_ORIGIN` as it is (`false`), build the site (`npm run build`), and either run
`npm run start:vm` (uses Angular's own server, quick, fine for a wedding site's traffic) or serve the built
`dist/wedding-site/browser` folder with any static file server on whatever port you like — `npx serve dist/wedding-site/browser -l 4500`,
for instance, needs nothing installed permanently. Start `server/` the same way as below (step 5) on the same VM,
open both ports in the VM's firewall/security group, and add the VM's address (with the site's port, e.g.
`http://203.0.113.7:4500`) to `ALLOWED_ORIGINS` in the server's `.env` — the automatic "allow my own Wi-Fi" rule only
covers private addresses, and a VM usually has a real, public one. Skip the rest of this guide; it is all about the
Nginx-plus-domain route.

## What you will need

- **A small server (a "VPS").** Any of DigitalOcean, Hetzner, Linode or a similar host works; the cheapest tier
  (about $4-6/month) is more than enough for a wedding site. Pick **Ubuntu 24.04** as the operating system when you
  create it. This is the one paid, real-world step - I cannot sign up for one on your behalf.
- **A domain name**, optional but recommended (so guests see `your-names.example` instead of a bare IP address, and
  so you can get free HTTPS). A `.com` for a few dollars a year works fine; point its DNS **A record** at the
  server's IP address once you have both (your registrar's dashboard explains how - it usually takes a few minutes
  to an hour to take effect).
- **An SSH client** to connect to the server. Windows 10/11 already has one built in - open PowerShell and type
  `ssh root@<the server's IP address>` (the host you chose will have emailed you the initial password, or let you
  add an SSH key when you created it).

Everything below is typed **on the server**, after you have connected with `ssh`.

## 1. Prepare the server (once)

```bash
apt update && apt upgrade -y
apt install -y nginx mysql-server git
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
```

This installs Nginx (serves the site and forwards `/api/...` to the small server), MySQL, Node.js and `pm2` (keeps
the API running, and restarts it automatically if the server reboots).

## 2. Get the database ready

Run MySQL's own setup once, then create the wedding database exactly as you did on your own computer:

```bash
mysql_secure_installation
```

Answer its questions (set a root password, decline anonymous users, etc.), then copy `server/schema.sql` onto the
server (see step 4 for how to get files there at all) and run it:

```bash
mysql -u root -p < schema.sql
```

This creates the database and its own low-privilege `wedding_rsvp` user, exactly like it did locally - a **new**
password for this server's copy of the database is inside the file, since it is the file that runs there, not the
one on your computer.

## 3. Build the site (on your own computer)

Building on the tiny server would be slow; build here instead and only upload the finished, small result:

```bash
npm run build
```

This makes `dist/wedding-site/browser/` - a folder of plain files (HTML, JS, CSS, your pictures). That folder, and
the `server/` folder (its code, not its `node_modules`), are the only two things that need to reach the server.

## 4. Get the files onto the server

Easiest with an SFTP program such as **WinSCP** or **FileZilla** (connect to the server the same way `ssh` did, then
drag folders across). From PowerShell, `scp` does the same thing without installing anything extra:

```powershell
scp -r dist/wedding-site/browser root@<server IP>:/var/www/wedding-site
scp -r server root@<server IP>:/opt/wedding-rsvp
scp server/schema.sql root@<server IP>:~
```

(If you would rather use `git`: push this project to a GitHub/GitLab repository from your computer once, then
`git clone` it on the server instead, and `git pull` there for every future update. Either way works equally well;
`git` is only nicer once you are updating the site more than once or twice.)

## 5. Start the API on the server

```bash
cd /opt/wedding-rsvp
npm install --omit=dev
cp .env.example .env
nano .env   # put in the password schema.sql printed for THIS server, and set NODE_ENV=production
pm2 start index.js --name wedding-rsvp
pm2 save
pm2 startup   # then run the one command it prints, so it also survives a reboot
```

Also add your real domain to `.env`'s `ALLOWED_ORIGINS` (e.g. `ALLOWED_ORIGINS=https://your-names.example`) - once
`NODE_ENV=production` is set, the automatic "allow my phone on the same Wi-Fi" rule from local testing no longer
applies (correctly - a guest's phone is never on this server's own private network), so the real domain has to be
listed by hand, once.

## 6. Tell Nginx about both pieces

```bash
nano /etc/nginx/sites-available/wedding-site
```

Paste this in (replace `your-names.example` with your real domain, or the server's bare IP if you are not using one
yet):

```nginx
server {
    listen 80;
    server_name your-names.example;

    root /var/www/wedding-site;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3010/api/;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Then switch it on:

```bash
ln -s /etc/nginx/sites-available/wedding-site /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

At this point, visiting the server's IP address (or your domain, once its DNS has caught up) already shows the
whole site working, RSVP included, over plain HTTP.

## 7. Add free HTTPS (only if you have a domain)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-names.example
```

It edits the Nginx config for you and renews itself automatically from then on. Guests are typing their name into a
form, so HTTPS is worth the five minutes this takes.

## Afterwards

- **To publish a change:** `npm run build` here, then re-upload the new `dist/wedding-site/browser/` folder over the
  old one (same `scp`/WinSCP step as before) - the API and database do not need touching for a wording or picture
  change.
- **To see who has RSVP'd:** `mysql -u root -p wedding_rsvp -e "SELECT * FROM rsvp_overview;"` on the server, or
  point MySQL Workbench at the server's address (only do this over an SSH tunnel or with the server's firewall
  restricted to your own IP - the database itself should never be reachable directly from the internet).
- **If the API ever seems down:** `pm2 status` and `pm2 logs wedding-rsvp` on the server show whether it is running
  and, if not, why.
- **Back up the guest list occasionally:** `mysqldump -u root -p wedding_rsvp > backup.sql` on the server, then copy
  that file down to your own computer.
