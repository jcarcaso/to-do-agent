# MacBook Pro Setup Guide

Steps to migrate the To-Do Agent from EC2 to a MacBook Pro.
The app connects to MongoDB Atlas (cloud), so no database migration is needed.

---

## 1. Install Cloudflare Tunnel

Gives you a stable HTTPS URL with no port forwarding. Free.

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create todoagent
cloudflared tunnel route dns todoagent <subdomain.yourdomain.com>
```

Create the tunnel config:

```bash
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: todoagent
credentials-file: /Users/<YOU>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: <subdomain.yourdomain.com>
    service: http://localhost:5000
  - service: http_status:404
EOF
```

Install as a system service so it survives reboots:

```bash
sudo cloudflared service install
```

## 2. Clone repo and install dependencies

```bash
git clone git@github.com:jcarcaso/to-do-agent.git ~/to-do-agent
cd ~/to-do-agent/client && npm install && npm run build
cd ~/to-do-agent/server && npm install
```

## 3. Set up `.env`

Copy your production `.env` to the repo root and update two values:

```bash
cp /path/to/backup/.env ~/to-do-agent/.env
```

Edit `~/to-do-agent/.env` and change:

| Variable             | Old (EC2)                                | New (Tunnel)                                      |
|----------------------|------------------------------------------|---------------------------------------------------|
| `CLIENT_URL`         | `https://old-ec2-url.com`                | `https://<subdomain.yourdomain.com>`              |
| `GOOGLE_CALLBACK_URL`| `https://old-ec2-url.com/api/auth/google/callback` | `https://<subdomain.yourdomain.com>/api/auth/google/callback` |

All other vars (MongoDB Atlas, Twilio, Claude, JWT, etc.) stay the same.

## 4. Update external services

### Google Cloud Console
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Edit your OAuth 2.0 client
3. Add `https://<subdomain.yourdomain.com>/api/auth/google/callback` to **Authorized redirect URIs**
4. Keep the old EC2 URI until you've verified the new setup works

### Twilio Console
1. Go to https://console.twilio.com → Phone Numbers → Active Numbers
2. Select your number
3. Update the SMS webhook URL to `https://<subdomain.yourdomain.com>/api/webhooks/twilio`

## 5. Create log directory and install the LaunchAgent

```bash
mkdir -p ~/Library/Logs/todoagent
```

Copy the plist template and edit paths:

```bash
cp ~/to-do-agent/deploy/launchagent.plist ~/Library/LaunchAgents/com.todoagent.server.plist
```

Edit `~/Library/LaunchAgents/com.todoagent.server.plist` and replace every `/Users/YOU/` with your actual home directory path (e.g. `/Users/jcarcaso/`).

Load the agent:

```bash
launchctl load ~/Library/LaunchAgents/com.todoagent.server.plist
```

## 6. Prevent MacBook from sleeping

- **System Settings → Energy Saver** (or Battery → Power Adapter on newer macOS):
  - Enable "Prevent automatic sleeping when the display is off"
  - Enable "Start up automatically after a power failure"

## 7. Verify everything works

Run through this checklist:

- [ ] `curl -s http://localhost:5000/health` returns OK
- [ ] App is accessible at `https://<subdomain.yourdomain.com>`
- [ ] Google OAuth login works
- [ ] SMS verify button in settings sends a test message
- [ ] Reply to that SMS and confirm inbound webhook works
- [ ] Wait for or manually trigger the morning check-in cron
- [ ] Reboot the MacBook and confirm the app comes back up automatically

Check logs if anything goes wrong:

```bash
tail -f ~/Library/Logs/todoagent/stdout.log
tail -f ~/Library/Logs/todoagent/stderr.log
```

## 8. Decommission from EC2

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
# View LaunchAgent status
launchctl list | grep todoagent

# Stop the server
launchctl unload ~/Library/LaunchAgents/com.todoagent.server.plist

# Start the server
launchctl load ~/Library/LaunchAgents/com.todoagent.server.plist

# Restart (stop then start)
launchctl unload ~/Library/LaunchAgents/com.todoagent.server.plist
launchctl load ~/Library/LaunchAgents/com.todoagent.server.plist

# View Cloudflare Tunnel status
sudo cloudflared service status

# View server logs
tail -f ~/Library/Logs/todoagent/stdout.log
tail -f ~/Library/Logs/todoagent/stderr.log
```
