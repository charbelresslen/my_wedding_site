# Putting the site online for real guests — on a Windows VM

This is the Windows counterpart of [DEPLOY.md](DEPLOY.md) (written for a Linux server) — same three things need a
public home (the site's files, the small API, and the database), same reasoning throughout, just Windows' own tools
in place of `apt`/Nginx/`systemctl`. Everything below is typed **on the VM**, either at its own screen or over
Remote Desktop (`mstsc.exe` from your own computer, if the VM allows RDP).

## The quick way: the site on its own port, no domain

This is the fastest path to "it works, guests on the internet can open it" — matches how you already asked to run
it (`npm run start:vm`, port 4500). No IIS, no reverse proxy, no domain needed; skip straight to
**"Afterwards"** once this works.

1. **Install Node.js and MySQL** on the VM (PowerShell, run as Administrator):

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

   For MySQL, the plain [MySQL Installer](https://dev.mysql.com/downloads/installer/) is easier than `winget` here —
   it walks you through setting a root password, the same as it did on your own computer. Open a **new** PowerShell
   window afterwards so it picks up `node`/`npm` on its `PATH`.

2. **Get the project onto the VM.** Simplest over Remote Desktop: enable clipboard sharing (it usually already is)
   and copy-paste the whole project folder from your computer into the VM, e.g. `C:\wedding-site`. (If you would
   rather use `git`, push this project to GitHub/GitLab from your computer once, install
   [Git for Windows](https://git-scm.com/download/win) on the VM, and `git clone` there instead — nicer for future
   updates, not required for a first deploy.)

3. **Set up the database** — open **PowerShell** in the project's `server` folder and run the schema exactly as you
   did locally:

   ```powershell
   Get-Content schema.sql | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
   ```

   (PowerShell has no `<` for feeding a file into a program's input the way other shells do - piping `Get-Content`
   into it is the normal way to do the same thing here.)

   Then `cd server`, `copy .env.example .env`, and open `.env` in Notepad to put in the password `schema.sql` printed
   for **this** VM's database (a fresh one, not the one on your own computer).

4. **Open the two ports in Windows' own firewall** (PowerShell, as Administrator):

   ```powershell
   New-NetFirewallRule -DisplayName "Wedding site" -Direction Inbound -Protocol TCP -LocalPort 4500 -Action Allow
   New-NetFirewallRule -DisplayName "Wedding RSVP API" -Direction Inbound -Protocol TCP -LocalPort 3010 -Action Allow
   ```

   **If this is a cloud VM** (Azure, AWS, etc.), there is a *second*, separate firewall to open too — the cloud
   provider's own "Network Security Group" / "Security Group" / firewall rules for the VM, in its web dashboard, not
   just Windows' own. Both need the same two ports open, or guests still cannot reach it.

5. **Start the API so it survives a reboot** — the simplest tool for "run this as a proper Windows Service" is
   [NSSM](https://nssm.cc/download): it is a zip, not an installer - unzip it anywhere (e.g. `C:\nssm`) and use the
   `win64\nssm.exe` inside it (or add that folder to `PATH` first; the commands below assume you have, for brevity):

   ```powershell
   nssm install WeddingRSVP "C:\Program Files\nodejs\node.exe" "C:\wedding-site\server\index.js"
   nssm set WeddingRSVP AppDirectory "C:\wedding-site\server"
   nssm start WeddingRSVP
   ```

   `nssm status WeddingRSVP` shows whether it is running. For logs: `nssm edit WeddingRSVP` opens the same setup
   window again for that service - open its **I/O** tab and set an output and error file path there (e.g.
   `C:\wedding-site\server\out.log` and `err.log`), then `Get-Content -Tail 50 -Wait <that path>` shows what the API
   is doing, live, if something goes wrong.

6. **Build and serve the site.** Build once from your own computer (`npm run build` there, same as always), copy the
   resulting `dist\wedding-site\browser` folder onto the VM, then serve it — either:

   - **Quickest:** on the VM, `npx serve C:\wedding-site\dist\wedding-site\browser -l 4500` (downloads a tiny static
     server on demand, nothing installed permanently); wrap it with NSSM too (same idea as step 5) so it survives a
     reboot, or
   - **More "IIS-native":** see the next section — IIS is Windows' own, always-on web server, and is barely more
     work once URL Rewrite is out of the way.

Guests reach it at `http://<the VM's public address>:4500` (find that address in the cloud host's dashboard, or
`ipconfig` if it is a VM on your own network). Add that exact address to `ALLOWED_ORIGINS` in `server\.env`
(e.g. `ALLOWED_ORIGINS=http://203.0.113.7:4500`) — the automatic "allow my own Wi-Fi" rule only covers private
addresses, and this one almost certainly is not one.

**If the site loads but the menu inside RSVP does not (works on your own computer, not once it's on the VM), it is
almost always one of these three things — in order of how often they turn out to be it:**

1. **`ALLOWED_ORIGINS` doesn't exactly match what the guest's browser sends.** It must match character-for-character:
   the right protocol (`http`, not `https`, unless you actually set up HTTPS), the site's own port (`:4500`, not the
   API's `:3010`), and no trailing slash. `server/index.js` now logs the exact origin it rejected (see the API's log
   file, set up in NSSM's **I/O** tab in step 5) — that line tells you exactly what to paste into `ALLOWED_ORIGINS`.
2. **You edited `server\.env` after the API was already started.** NSSM's Node process only reads `.env` once, at
   startup — a later edit does nothing until you restart it: `nssm restart WeddingRSVP`.
3. **Port 3010 isn't actually reachable from outside the VM** (only 4500 was opened, or the cloud NSG has a rule for
   one port but not the other). Check this from your own computer, before assuming it's `ALLOWED_ORIGINS`:
   ```powershell
   Test-NetConnection -ComputerName <the VM's public address> -Port 3010
   ```
   `TcpTestSucceeded: True` means the port is reachable and the problem is CORS (point 1); `False` means a firewall
   somewhere is still blocking it — check both Windows' own rules (step 4) and, separately, the cloud host's NSG.

## The fuller way: IIS, one address, a real domain, HTTPS

This mirrors DEPLOY.md's Linux recipe: the site and the API sit behind the *same* address, so there is no
cross-origin (CORS) step to think about, and guests get a real `https://your-names.example` instead of an IP and a
port number. It needs one code change first: open `src/app/rsvp/rsvp.ts` and set `SAME_ORIGIN = true` (it defaults
to `false`, which is correct for the quick path above, but not for this one), then `npm run build` again.

### 1. Turn on IIS

Windows Server:

```powershell
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
```

Windows 10/11: Control Panel → Programs → *Turn Windows features on or off* → tick **Internet Information Services**
(or `Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -All` in an Administrator PowerShell).

### 2. Add URL Rewrite and Application Request Routing (ARR)

These two are IIS *extensions*, not part of Windows itself — download and run both installers from the Microsoft
IIS site:

- [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
- [Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)

Then, in **IIS Manager**, click the **server** name (top of the left-hand tree, not a site) → **Application Request
Routing Cache** → **Server Proxy Settings** on the right → tick **Enable proxy** → **Apply**. Without this one tick,
IIS will refuse to forward anything to the API and every RSVP request will fail.

### 3. Create the site

In IIS Manager: **Sites** → **Add Website** → point its **physical path** at the `browser` folder you built and
copied over (e.g. `C:\wedding-site\dist\wedding-site\browser`), give it a **binding** on port 80 (and 443 once
HTTPS is set up) with the domain's **host name** filled in, once the domain's DNS **A record** points at this VM's
address.

### 4. Tell IIS about the pictures, the font and the video, and about `/api/`

Angular's build does not add a Windows-specific config file, so IIS needs one dropped into the site's folder. Save
this as `web.config`, next to `index.html` (i.e. inside `browser`, so it also survives the next `npm run build` +
re-copy as long as you copy this file across again too, or keep a copy of it outside `dist` and copy it in each time):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".webp" />
      <mimeMap fileExtension=".webp" mimeType="image/webp" />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
      <remove fileExtension=".mp4" />
      <mimeMap fileExtension=".mp4" mimeType="video/mp4" />
    </staticContent>
    <rewrite>
      <rules>
        <!-- /api/... is forwarded to the Node process (started with NSSM, same as the quick path's step 5),
             instead of IIS looking for a matching file and returning 404 -->
        <rule name="RSVP API" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:3010/api/{R:1}" />
        </rule>
        <!-- everything else that is not a real file goes to index.html, so a refresh never 404s -->
        <rule name="SPA fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

(`<remove>` before every `<mimeMap>` avoids an error if that extension already happens to be registered on this
particular Windows/IIS version — some of the three already are, some are not, and it is safer not to guess which.)

Start the API the same way as the quick path's step 5 (NSSM) — IIS forwards to it, but does not run it.

### 5. Free HTTPS

IIS has no Let's Encrypt client of its own; [win-acme](https://www.win-acme.com/) is the standard free one. Download
it, run `wacs.exe` from an Administrator prompt, choose the IIS site you just made, and let it bind the certificate
and set up its own renewal task - no further action needed afterwards.

## Afterwards

- **To publish a change:** `npm run build` on your own computer, copy the new `browser` folder over the old one on
  the VM (keeping your `web.config`, if you added one) — the API and the database do not need touching for a
  wording or picture change.
- **To see who has RSVP'd:** open MySQL Workbench on your own computer and connect to the VM's MySQL (only over an
  RDP session or a VPN/SSH tunnel — never open MySQL's own port, 3306, to the internet), or run
  `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p wedding_rsvp -e "SELECT * FROM rsvp_overview;"`
  directly on the VM.
- **If the API ever seems down:** `nssm status WeddingRSVP`, and the log file path you gave it in NSSM's setup, show
  whether it is running and, if not, why.
- **Back up the guest list occasionally:**
  `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u root -p wedding_rsvp > backup.sql` on the VM,
  then copy that file down to your own computer.
