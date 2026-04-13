# Ubuntu Server Setup Guide (MacBook Pro)

Steps to migrate the To-Do Agent from EC2 to a MacBook Pro running Ubuntu Server.
The app connects to MongoDB Atlas (cloud), so no database migration is needed.
The app shells out to the `claude` CLI (Claude Code subscription) instead of using API tokens.

---

## 1. Install Node.js via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

## 2. Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

Log in to activate your subscription:

```bash
claude
# Follow the OAuth login flow in a browser
```

Verify it works:

```bash
claude -p "hello" --output-format json
```

## 3. Install Cloudflare Tunnel

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb
```

Set up the tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create todoagent
cloudflared tunnel route dns todoagent <subdomain.yourdomain.com>
```

Create the config:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: todoagent
credentials-file: /home/<YOU>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: <subdomain.yourdomain.com>
    service: http://localhost:5000
  - service: http_status:404
```

Install as a systemd service:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
```

## 4. Clone repo and install dependencies

```bash
git clone git@github.com:jcarcaso/to-do-agent.git ~/to-do-agent
cd ~/to-do-agent/client && npm install && npm run build
cd ~/to-do-agent/server && npm install
```

## 5. Set up `.env`

Create `~/to-do-agent/.env` with your production values. Update two values:

| Variable             | Old (EC2)                                | New (Tunnel)                                      |
|----------------------|------------------------------------------|---------------------------------------------------|
| `CLIENT_URL`         | `https://old-ec2-url.com`                | `https://<subdomain.yourdomain.com>`              |
| `GOOGLE_CALLBACK_URL`| `https://old-ec2-url.com/api/auth/google/callback` | `https://<subdomain.yourdomain.com>/api/auth/google/callback` |

Also make sure these are set:

| Variable               | Value |
|------------------------|-------|
| `CLAUDE_PATH`          | Path to claude binary (run `which claude` to find it) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Your OAuth token (check `~/.claude/` after logging in) |

All other vars (MongoDB Atlas, Twilio, JWT, etc.) stay the same.

## 6. Update external services

### Google Cloud Console
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Edit your OAuth 2.0 client
3. Add `https://<subdomain.yourdomain.com>/api/auth/google/callback` to **Authorized redirect URIs**
4. Keep the old EC2 URI until you've verified the new setup works

### Twilio Console
1. Go to https://console.twilio.com → Phone Numbers → Active Numbers
2. Select your number
3. Update the SMS webhook URL to `https://<subdomain.yourdomain.com>/api/webhooks/twilio`

## 7. Install the systemd service

```bash
sudo cp ~/to-do-agent/deploy/todoagent.service /etc/systemd/system/todoagent.service
```

Edit the file and replace `YOUR_USER` with your actual username:

```bash
sudo nano /etc/systemd/system/todoagent.service
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable todoagent
sudo systemctl start todoagent
```

## 8. Prevent the MacBook from sleeping

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

If the lid will be closed:

```bash
sudo nano /etc/systemd/logind.conf
# Set: HandleLidSwitch=ignore
# Set: HandleLidSwitchExternalPower=ignore
sudo systemctl restart systemd-logind
```

## 9. Verify everything works

```bash
# Check the service is running
sudo systemctl status todoagent

# Check health endpoint
curl -s http://localhost:5000/health
```

Run through this checklist:

- [ ] App is accessible at `https://<subdomain.yourdomain.com>`
- [ ] Google OAuth login works
- [ ] AI chat responds (confirms Claude CLI is working)
- [ ] SMS verify button in settings sends a test message
- [ ] Reply to that SMS and confirm inbound webhook works
- [ ] Wait for or manually trigger the morning check-in cron
- [ ] Reboot the MacBook and confirm the app comes back up automatically

## 10. Decommission from EC2

Once everything is verified:

```bash
# On the EC2 instance
pm2 stop to-do-agent
pm2 delete to-do-agent
rm -rf ~/to-do-agent
```

Remove the old Google OAuth redirect URI from Google Cloud Console.
The EC2 instance continues hosting WordPress only.

## Useful commands

```bash
# Service status
sudo systemctl status todoagent

# Stop / start / restart
sudo systemctl stop todoagent
sudo systemctl start todoagent
sudo systemctl restart todoagent

# View logs (live)
journalctl -u todoagent -f

# View recent logs
journalctl -u todoagent --since "1 hour ago"

# Cloudflare Tunnel status
sudo systemctl status cloudflared

# Update the app (pull + restart)
cd ~/to-do-agent && git pull
cd client && npm install && npm run build
cd ../server && npm install
sudo systemctl restart todoagent
```
