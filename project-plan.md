# AI-Powered Personal Task Management System - Project Plan

## Executive Summary

A conversational AI-powered todo list application that learns from your patterns, integrates with Google Calendar, and proactively helps you plan your day across multiple channels (in-app, email, SMS).

**Tech Stack:** MERN (MongoDB, Express, React, Node.js) + Claude API + Docker
**Deployment:** AWS EC2 (us-east-1) with automated backups
**Target Cost:** <$20/month AWS costs

---

## System Architecture

### High-Level Architecture

```
┌─────────────────┐
│  React PWA      │ ← Progressive Web App (Phone + Desktop)
│  (Frontend)     │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────┐
│  Nginx Reverse  │ ← SSL/TLS Termination
│  Proxy          │
└────────┬────────┘
         │
         ↓
┌─────────────────┐     ┌──────────────────┐
│  Node.js/Express│────→│  MongoDB Atlas   │
│  API Server     │     │  (Free Tier)     │
└────────┬────────┘     └──────────────────┘
         │
         ├──→ Claude API (Anthropic)
         ├──→ Google Calendar API
         ├──→ Google OAuth 2.0
         ├──→ SendGrid API (Email)
         └──→ Twilio API (SMS)

All running in Docker containers on EC2
```

### Data Flow for AI Agent

```
Morning Check-in Trigger (Cron Job)
    ↓
Fetch User's Tasks + Calendar + Historical Patterns
    ↓
Claude API: "Plan the day based on availability and priorities"
    ↓
Store Conversation in MongoDB
    ↓
Show in-app when user opens (+ optional email/SMS)
    ↓
User responds via any channel
    ↓
Claude API: Process response + Update tasks/calendar
    ↓
Persist updates + Learn from patterns
```

---

## Database Schema Design

### Collections

#### 1. **users**
```javascript
{
  _id: ObjectId,
  googleId: String,
  email: String,
  name: String,
  picture: String,
  preferences: {
    morningCheckInTime: String, // "08:00"
    timezone: String,
    notificationChannels: {
      inApp: Boolean,
      email: Boolean,
      sms: Boolean
    },
    phoneNumber: String // for SMS
  },
  googleCalendarTokens: {
    accessToken: String,
    refreshToken: String,
    expiryDate: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. **tasks**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  title: String,
  description: String,
  status: String, // 'pending', 'in_progress', 'completed', 'archived'
  
  // Attributes
  tags: [String], // ['work', 'personal', 'urgent']
  type: String, // 'work', 'personal', 'health', 'learning', etc.
  estimatedDuration: Number, // minutes
  actualDuration: Number, // minutes (tracked when completed)
  priority: String, // 'low', 'medium', 'high', 'critical'
  dueDate: Date,
  
  // Recurring tasks
  isRecurring: Boolean,
  recurrence: {
    frequency: String, // 'daily', 'weekly', 'monthly'
    interval: Number, // every N days/weeks/months
    daysOfWeek: [Number], // [0,1,2,3,4,5,6] for Sun-Sat
    endDate: Date
  },
  
  // Dependencies
  parentTaskId: ObjectId, // null for top-level tasks
  subtasks: [ObjectId],
  dependencies: [ObjectId], // tasks that must be completed first
  
  // AI Learning Data
  completedAt: Date,
  completedDuringHour: Number, // 0-23, for pattern recognition
  aiEstimatedDuration: Number, // Claude's estimate based on similar tasks
  similarTaskIds: [ObjectId], // for learning
  
  // Calendar Integration
  googleCalendarEventId: String, // when time-blocked
  scheduledStart: Date,
  scheduledEnd: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 3. **conversations**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: String, // 'morning_checkin', 'task_planning', 'ad_hoc'
  channel: String, // 'in_app', 'email', 'sms'
  
  messages: [{
    role: String, // 'user' or 'assistant'
    content: String,
    timestamp: Date,
    channel: String
  }],
  
  // Context for the conversation
  context: {
    date: Date,
    tasksDiscussed: [ObjectId],
    suggestedPlan: Object,
    calendarAvailability: Object
  },
  
  status: String, // 'active', 'completed'
  createdAt: Date,
  updatedAt: Date
}
```

#### 4. **user_patterns** (for AI learning)
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  
  // Completion patterns
  completionRateByHour: Object, // {0: 0.2, 1: 0.1, ..., 23: 0.8}
  completionRateByDayOfWeek: Object, // {0: 0.7, 1: 0.8, ...}
  completionRateByTaskType: Object, // {'work': 0.85, 'personal': 0.6}
  
  // Duration accuracy
  estimationAccuracy: Object, // {'work': 0.9, 'personal': 0.7}
  averageDurationByType: Object, // {'code_review': 30, 'meeting': 60}
  
  // Task preferences
  preferredTaskTypes: [String],
  mostProductiveHours: [Number], // [9, 10, 11, 14, 15]
  
  // Statistics (for future analytics)
  totalTasksCompleted: Number,
  totalTasksCreated: Number,
  averageCompletionTime: Number, // days from creation to completion
  
  lastCalculated: Date,
  updatedAt: Date
}
```

#### 5. **backups_metadata**
```javascript
{
  _id: ObjectId,
  backupDate: Date,
  s3Key: String,
  size: Number,
  collections: [String],
  status: String, // 'completed', 'failed'
  expiresAt: Date // 30 days from backupDate
}
```

---

## Tech Stack Details

### Frontend (React PWA)
- **React 18** with hooks
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Workbox** for service worker/offline functionality
- **React Query** for data fetching and caching
- **Socket.io-client** for real-time updates
- **Date-fns** for date manipulation
- **React DnD** for drag-drop task organization

### Backend (Node.js/Express)
- **Express.js** API server
- **Passport.js** with Google OAuth strategy
- **Mongoose** for MongoDB ODM
- **Socket.io** for real-time communication
- **Node-cron** for scheduled jobs (morning check-in)
- **Anthropic SDK** for Claude API
- **Google APIs Client** for Calendar integration
- **SendGrid SDK** for email
- **Twilio SDK** for SMS
- **Helmet** for security headers
- **Express-rate-limit** for API throttling
- **Winston** for logging

### Database
- **MongoDB Atlas** (Free tier: 512MB) for main data
- **AWS S3** for weekly backups with 30-day retention

### DevOps
- **Docker & Docker Compose** for containerization
- **Nginx** as reverse proxy with SSL
- **Let's Encrypt** for free SSL certificates
- **PM2** for process management (inside container)
- **GitHub Actions** (optional) for CI/CD

---

## Development Phases

### Phase 1: Foundation & Infrastructure (Week 1-2)

**Goals:** Set up development environment, AWS infrastructure, and basic authentication

#### Tasks:

**1.1 Local Development Setup**
- Initialize Git repository with proper .gitignore
- Set up project structure (monorepo with /client and /server)
- Create Docker Compose for local development (MongoDB, Node, React)
- Configure environment variables (.env.example)

**1.2 AWS Infrastructure**
- Set up EC2 instance (t3.micro or t3.small)
- Configure security groups (SSH, HTTP, HTTPS)
- Set up Elastic IP for static IP address
- Create S3 bucket for backups with lifecycle policy (30-day expiration)
- Set up IAM roles for EC2 to access S3

**1.3 Docker Configuration**
- Create Dockerfile for Node.js backend
- Create Dockerfile for React frontend
- Create docker-compose.yml for production
- Set up Nginx reverse proxy container with SSL support
- Configure automatic SSL renewal with Certbot

**1.4 Basic Backend Setup**
- Initialize Express server
- Set up MongoDB connection (start with MongoDB Atlas free tier)
- Implement health check endpoint
- Set up logging with Winston
- Configure CORS properly

**1.5 Google Authentication**
- Set up Google Cloud Console project
- Configure OAuth 2.0 credentials
- Implement Passport.js Google OAuth strategy
- Create JWT token generation for session management
- Build protected route middleware

**1.6 Basic Frontend Setup**
- Initialize React app with Vite (faster than CRA)
- Set up React Router
- Configure Tailwind CSS
- Create basic layout components (Header, Sidebar, Main)
- Implement Google Sign-In button
- Set up API client with axios/fetch

**Deliverables:**
- Working authentication flow (Google Sign-In)
- Deployed to EC2 with HTTPS
- Basic UI scaffold
- Docker containers running in production

---

### Phase 2: Core Task Management (Week 3-4)

**Goals:** Build full CRUD for tasks with all attributes, dependencies, and calendar sync

#### Tasks:

**2.1 Task API Endpoints**
- POST /api/tasks - Create task
- GET /api/tasks - List tasks (with filtering, sorting, pagination)
- GET /api/tasks/:id - Get single task with subtasks
- PUT /api/tasks/:id - Update task
- DELETE /api/tasks/:id - Delete task (cascade to subtasks)
- POST /api/tasks/:id/subtasks - Add subtask
- PUT /api/tasks/:id/status - Update status with validation
- GET /api/tasks/:id/dependencies - Check dependency chain

**2.2 Task Dependency Logic**
- Implement dependency validation (no circular dependencies)
- Build dependency graph resolver
- Auto-update parent task status based on subtasks
- Block task completion if dependencies incomplete

**2.3 Google Calendar Integration**
- Implement token refresh mechanism
- GET /api/calendar/events - Fetch user's calendar
- POST /api/tasks/:id/schedule - Block time on calendar for task
- PUT /api/tasks/:id/reschedule - Update calendar event
- DELETE /api/calendar/events/:id - Remove time block
- Sync task completion back to calendar

**2.4 Recurring Tasks**
- Implement recurrence logic (daily, weekly, monthly)
- Create cron job to generate recurring task instances
- Handle "complete all future occurrences" vs "complete this instance"

**2.5 Frontend Task Management**
- Task list view with filters (status, priority, type, tags)
- Task detail modal/page
- Create/Edit task form with all attributes
- Drag-and-drop for priorities
- Subtask creation and dependency selection
- Calendar view showing scheduled tasks
- Quick actions (complete, defer, delete)

**2.6 Data Persistence & Modeling**
- Finalize task schema in MongoDB
- Add indexes for common queries (userId, status, dueDate)
- Implement soft delete for tasks (status: 'archived')
- Set up data validation with Mongoose schemas

**Deliverables:**
- Full task CRUD with dependencies and subtasks
- Google Calendar two-way sync
- Recurring task generation
- Functional task management UI

---

### Phase 3: AI Agent Integration (Week 5-7)

**Goals:** Integrate Claude API for conversational planning, learning, and daily check-ins

#### Tasks:

**3.1 Claude API Setup**
- Set up Anthropic API credentials
- Create service layer for Claude interactions
- Design system prompts for different contexts:
  - Morning check-in
  - Task planning
  - Duration estimation
  - Ad-hoc conversations
- Implement conversation history management

**3.2 Morning Check-In System**
- Create cron job for daily trigger (customizable per user)
- Build context aggregation:
  - Pending tasks with priorities
  - Today's calendar events
  - User's historical patterns
  - Yesterday's incomplete tasks
- Generate initial check-in message via Claude
- Store conversation in database
- Display in-app notification when user opens app

**3.3 Multi-Channel Conversation**
- **In-App Chat:**
  - Build real-time chat interface with Socket.io
  - Display conversation history
  - Support rich formatting (task links, checkboxes)
  
- **Email Integration:**
  - Set up SendGrid account
  - Implement inbound email parsing (reply to check-in emails)
  - Send formatted emails with task summaries
  
- **SMS Integration:**
  - Set up Twilio account
  - Implement SMS webhook for replies
  - Keep messages concise for SMS context

- **Unified Message Router:**
  - Route all channels to Claude API
  - Maintain conversation context across channels
  - Sync conversation state

**3.4 AI Task Planning**
- Endpoint: POST /api/ai/plan-day
- Claude analyzes:
  - Available time blocks from calendar
  - Task priorities and due dates
  - Estimated durations
  - Dependencies
- Suggests realistic daily plan
- Can block time on calendar for suggested tasks
- User can accept/modify/reject suggestions

**3.5 Duration Estimation**
- Endpoint: POST /api/ai/estimate-duration
- Find similar completed tasks based on:
  - Task type
  - Tags
  - Title/description similarity
- Claude analyzes patterns and provides estimate
- Store estimate in task.aiEstimatedDuration
- Learn from actual vs estimated over time

**3.6 Pattern Learning System**
- Create background job to calculate user_patterns
- Run weekly or after every N completed tasks
- Analyze:
  - Completion rates by time/day/type
  - Duration accuracy
  - Productive hours
- Use patterns to improve Claude's suggestions

**3.7 Conversation Memory**
- Store full conversation history
- Provide context to Claude about recent discussions
- Reference previous decisions/preferences
- "Remember last week you said you work best in mornings"

**Deliverables:**
- Morning check-in appears when user opens app
- Conversational AI via in-app chat, email, and SMS
- AI suggests daily plans based on calendar availability
- Duration estimation based on similar tasks
- Pattern learning from completed tasks

---

### Phase 4: Progressive Web App & Polish (Week 8)

**Goals:** Make app installable, work offline, and provide excellent mobile UX

#### Tasks:

**4.1 PWA Setup**
- Create manifest.json with app metadata
- Design app icons (multiple sizes)
- Configure Workbox for service worker
- Implement offline caching strategy:
  - Cache task list for offline viewing
  - Queue task updates when offline
  - Sync when back online

**4.2 Mobile-Responsive Design**
- Optimize all views for mobile (320px+)
- Implement mobile navigation (hamburger menu)
- Add touch-friendly interactions
- Bottom navigation bar for mobile
- Swipe gestures (swipe to complete, swipe to delete)

**4.3 Performance Optimization**
- Implement React.lazy for code splitting
- Optimize bundle size (analyze with webpack-bundle-analyzer)
- Add loading states and skeletons
- Implement virtual scrolling for long task lists
- Optimize images and assets

**4.4 Notifications**
- Service worker push notification support
- In-app notification system for morning check-ins
- Toast notifications for task updates
- Optional: Browser notifications for approaching due dates

**4.5 User Settings & Preferences**
- Settings page:
  - Morning check-in time
  - Timezone
  - Notification channels (toggle in-app, email, SMS)
  - Phone number for SMS
  - Theme (light/dark mode)
  - Default task attributes
- Persist preferences in user document

**4.6 Polish & UX Improvements**
- Add animations and transitions
- Implement keyboard shortcuts
- Add empty states with helpful messaging
- Create onboarding flow for new users
- Add help tooltips
- Error handling and user-friendly error messages

**Deliverables:**
- Installable PWA on mobile and desktop
- Offline functionality
- Polished, responsive UI
- User preferences and settings

---

### Phase 5: Backups, Monitoring & Launch (Week 9)

**Goals:** Production-ready with automated backups, monitoring, and documentation

#### Tasks:

**5.1 Automated Backup System**
- Create backup script:
  - Use mongodump to export all collections
  - Compress with gzip
  - Upload to S3 with timestamp
  - Store metadata in backups_metadata collection
- Set up weekly cron job (Sunday 2 AM)
- Implement automatic cleanup (delete backups older than 30 days)
- Create restore script for disaster recovery
- Test backup and restore procedures

**5.2 Monitoring & Logging**
- Set up CloudWatch for EC2 metrics
- Configure Winston to log to files with rotation
- Implement error tracking (optional: Sentry free tier)
- Add application metrics:
  - API response times
  - Claude API usage and costs
  - Database query performance
  - Active users
- Create simple admin dashboard endpoint

**5.3 Security Hardening**
- Implement rate limiting on all endpoints
- Add CSRF protection
- Sanitize user inputs
- Set security headers (Helmet)
- Regular dependency updates (Dependabot)
- Environment variable validation
- Implement API key rotation strategy

**5.4 Testing**
- Unit tests for critical backend logic (dependencies, patterns)
- Integration tests for API endpoints
- E2E tests for authentication flow (Playwright/Cypress)
- Test Claude API integration with mock responses

**5.5 Documentation**
- README with setup instructions
- API documentation (Swagger/OpenAPI)
- Architecture diagrams
- Deployment guide
- Backup/restore procedures
- Troubleshooting guide

**5.6 Cost Optimization**
- Monitor AWS costs
- Optimize MongoDB Atlas queries
- Cache frequently accessed data
- Implement Claude API request batching where possible
- Set up billing alerts

**Deliverables:**
- Automated weekly backups to S3
- Monitoring and logging in place
- Security hardened
- Comprehensive documentation
- Production-ready application

---

## AWS Infrastructure Setup Guide

### EC2 Instance Configuration

**Recommended Instance:**
- Type: t3.small (2 vCPU, 2GB RAM) - ~$15/month
- Alternative: t3.micro (1 vCPU, 1GB RAM) - ~$7.50/month (may need swap for Docker)
- OS: Ubuntu 24.04 LTS
- Storage: 20GB gp3 SSD

**Security Group Rules:**
```
Inbound:
- SSH (22) - Your IP only
- HTTP (80) - 0.0.0.0/0
- HTTPS (443) - 0.0.0.0/0

Outbound:
- All traffic (required for package installation, API calls)
```

**Elastic IP:**
- Allocate and associate to prevent IP changes on restart
- Cost: Free while instance is running

### S3 Bucket for Backups

**Configuration:**
```
Bucket name: your-todo-app-backups-{random}
Region: us-east-1 (same as EC2)
Versioning: Disabled (save costs)
Lifecycle Policy:
  - Expire objects after 30 days
Encryption: AES-256 (default)
Public access: Blocked
```

**IAM Role for EC2:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::your-todo-app-backups-{random}",
        "arn:aws:s3:::your-todo-app-backups-{random}/*"
      ]
    }
  ]
}
```

### MongoDB Atlas (Free Tier)

- Sign up at mongodb.com/cloud/atlas
- Create free M0 cluster (512MB)
- Region: us-east-1 (closest to EC2)
- Whitelist EC2 public IP
- Create database user with strong password
- Get connection string

---

## Cost Estimate

### Monthly Costs (USD)

| Service | Configuration | Cost |
|---------|--------------|------|
| EC2 t3.small | 24/7 runtime | ~$15.00 |
| Elastic IP | Associated with running instance | $0.00 |
| EBS Storage | 20GB gp3 | ~$1.60 |
| S3 Storage | ~1GB backups | ~$0.02 |
| S3 Requests | Weekly backups + cleanup | ~$0.01 |
| MongoDB Atlas | Free M0 tier | $0.00 |
| Data Transfer | Minimal (1-2GB/month) | ~$0.20 |
| **AWS Subtotal** | | **~$16.83** |
| | | |
| Claude API | ~1000 API calls/month (Sonnet) | ~$3.00 |
| Google Calendar API | Free (under 1M requests) | $0.00 |
| SendGrid Email | Free tier (100 emails/day) | $0.00 |
| Twilio SMS | Pay-as-you-go (~$0.0075/msg) | ~$1.00 |
| **External Services** | | **~$4.00** |
| | | |
| **Total Estimated** | | **~$20.83/month** |

### Cost Optimization Tips:
1. Use t3.micro if comfortable with lower resources (~$7.50/month savings)
2. Stop instance during extended non-use periods
3. Limit Claude API calls by caching responses
4. Use email over SMS when possible (SMS costs per message)
5. Monitor CloudWatch for cost anomalies

---

## Docker Configuration

### Project Structure
```
/your-todo-app/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

### Sample docker-compose.yml (Production)

```yaml
version: '3.8'

services:
  # Backend API
  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: todo-api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=5000
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}
      - AWS_REGION=us-east-1
      - S3_BACKUP_BUCKET=${S3_BACKUP_BUCKET}
    volumes:
      - ./server/logs:/app/logs
    networks:
      - app-network
    depends_on:
      - mongo
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend
  client:
    build:
      context: ./client
      dockerfile: Dockerfile
      args:
        - REACT_APP_API_URL=${API_URL}
    container_name: todo-client
    restart: unless-stopped
    networks:
      - app-network

  # Nginx Reverse Proxy
  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    container_name: todo-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl
      - ./nginx/certbot:/var/www/certbot
    networks:
      - app-network
    depends_on:
      - api
      - client

  # MongoDB (local for development; use Atlas in production)
  mongo:
    image: mongo:7
    container_name: todo-mongo
    restart: unless-stopped
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
    volumes:
      - mongo-data:/data/db
    networks:
      - app-network
    # Comment out in production if using MongoDB Atlas

networks:
  app-network:
    driver: bridge

volumes:
  mongo-data:
```

### Sample Dockerfile (Backend)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 5000

CMD ["node", "src/index.js"]
```

### Sample Dockerfile (Frontend)

```dockerfile
# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## Deployment Steps

### Initial Setup on EC2

```bash
# 1. Connect to EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# 2. Update system
sudo apt update && sudo apt upgrade -y

# 3. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

# 4. Install Docker Compose
sudo apt install docker-compose-plugin -y

# 5. Install Git
sudo apt install git -y

# 6. Clone repository
git clone https://github.com/yourusername/your-todo-app.git
cd your-todo-app

# 7. Set up environment variables
cp .env.example .env
nano .env  # Fill in all secrets

# 8. Set up SSL with Let's Encrypt
sudo apt install certbot -y
sudo certbot certonly --standalone -d yourdomain.com

# 9. Build and run containers
docker compose up -d --build

# 10. Check logs
docker compose logs -f

# 11. Set up backup cron job
crontab -e
# Add: 0 2 * * 0 /home/ubuntu/your-todo-app/scripts/backup.sh
```

### Continuous Deployment

```bash
# On EC2, create update script: ~/update-app.sh
#!/bin/bash
cd /home/ubuntu/your-todo-app
git pull origin main
docker compose down
docker compose up -d --build
docker system prune -f
```

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Tasks
- `GET /api/tasks` - List tasks (query: status, type, priority, dueDate, search)
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task with subtasks
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task (soft delete)
- `POST /api/tasks/:id/subtasks` - Add subtask
- `PUT /api/tasks/:id/status` - Update status
- `POST /api/tasks/:id/complete` - Mark complete (with actualDuration)

### Calendar Integration
- `GET /api/calendar/events` - Get calendar events
- `POST /api/tasks/:id/schedule` - Block time on calendar
- `PUT /api/tasks/:id/reschedule` - Update scheduled time
- `DELETE /api/tasks/:id/unschedule` - Remove from calendar

### AI Agent
- `POST /api/ai/morning-checkin` - Trigger morning check-in
- `POST /api/ai/plan-day` - Get AI-suggested daily plan
- `POST /api/ai/estimate-duration` - Estimate task duration
- `POST /api/ai/chat` - Send message to AI (any channel)
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation history

### User & Settings
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/preferences` - Update preferences
- `GET /api/user/patterns` - Get learning patterns

### Webhooks (for external channels)
- `POST /api/webhooks/sendgrid` - Inbound email webhook
- `POST /api/webhooks/twilio` - Inbound SMS webhook

---

## Environment Variables

### Required .env Variables

```bash
# Node Environment
NODE_ENV=production
PORT=5000

# MongoDB (Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/todo-app?retryWrites=true&w=majority

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# SendGrid (Email)
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890

# AWS
AWS_REGION=us-east-1
S3_BACKUP_BUCKET=your-todo-app-backups-xxxxx

# Frontend URL (for CORS)
CLIENT_URL=https://yourdomain.com

# MongoDB Local (for development only)
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-mongo-password
```

---

## Learning & Adaptation Strategy

### How the AI Agent Learns

**1. Pattern Recognition:**
- After every 10 completed tasks, recalculate user_patterns
- Identify productive hours, completion rates, task preferences
- Feed patterns to Claude in system prompt for future conversations

**2. Duration Learning:**
- Compare aiEstimatedDuration vs actualDuration
- Build similarity index between tasks (title, type, tags)
- Use historical data to improve estimates
- Claude receives context: "Similar 'code review' tasks took 25-35 min"

**3. Conversational Memory:**
- Store all conversations with full context
- Claude receives recent conversation summaries
- Example prompt addition: "User mentioned they prefer morning workouts"

**4. Adaptive Suggestions:**
- Track which suggestions user accepts/rejects
- Adjust future suggestions based on patterns
- Learn preferred task ordering (e.g., quick wins first vs hardest first)

### Sample Claude System Prompt (Morning Check-In)

```
You are an AI productivity assistant helping the user plan their day. Be conversational but direct and concise.

USER CONTEXT:
- Name: {user.name}
- Timezone: {user.timezone}
- Today: {today}

CALENDAR AVAILABILITY:
{calendarSummary}

PENDING TASKS:
{tasksList with priorities, due dates, estimates}

USER PATTERNS:
- Most productive: {patterns.mostProductiveHours}
- Completion rate by type: {patterns.completionRateByTaskType}
- Recent conversation context: {recentConversations}

INSTRUCTIONS:
1. Greet the user warmly and briefly
2. Suggest 3-5 tasks for today based on:
   - Due dates (prioritize approaching deadlines)
   - Available time blocks
   - Task dependencies
   - User's productive hours
   - Estimated durations
3. Propose a realistic plan that fits their calendar
4. Ask which tasks they'd like to commit to today
5. Offer to block time on their calendar for selected tasks

Be encouraging but realistic. Don't overload their day. If they have limited time, suggest fewer tasks or breaking large tasks into smaller pieces.
```

---

## Security Considerations

### Best Practices Implemented

1. **Authentication:**
   - Google OAuth 2.0 (no password storage)
   - JWT tokens with expiration
   - HTTP-only cookies for token storage
   - CSRF protection

2. **API Security:**
   - Rate limiting (100 requests/15 min per user)
   - Input validation and sanitization
   - Helmet.js security headers
   - CORS whitelist

3. **Data Protection:**
   - MongoDB connection over TLS
   - Environment variables for secrets (never in code)
   - Encrypted backups in S3
   - No sensitive data in logs

4. **Infrastructure:**
   - EC2 security groups (minimal open ports)
   - SSH key-based authentication only
   - Regular security updates
   - SSL/TLS for all traffic

5. **Third-party APIs:**
   - API keys in environment variables
   - Rotate keys regularly
   - Monitor usage for anomalies

---

## Testing Strategy

### Test Coverage Goals

1. **Unit Tests (Backend):**
   - Task dependency resolution
   - Recurrence logic
   - Pattern calculation algorithms
   - JWT token generation/validation
   - Input validation functions

2. **Integration Tests:**
   - Authentication flow
   - Task CRUD operations
   - Calendar sync
   - AI conversation flow

3. **E2E Tests (Critical Paths):**
   - User sign-in
   - Create task → Complete task → Verify patterns update
   - Schedule task → Check calendar sync
   - Morning check-in flow

### Testing Tools
- **Jest** for unit tests
- **Supertest** for API integration tests
- **Playwright** or **Cypress** for E2E tests

---

## Monitoring & Observability

### Key Metrics to Track

1. **Application Health:**
   - API response times (p50, p95, p99)
   - Error rates by endpoint
   - Active users (daily, weekly)
   - Task completion rate

2. **Infrastructure:**
   - EC2 CPU and memory usage
   - Disk space
   - Network throughput
   - MongoDB Atlas performance

3. **External Services:**
   - Claude API usage and costs
   - Google Calendar API quota
   - SendGrid email delivery rate
   - Twilio SMS delivery rate

4. **User Engagement:**
   - Morning check-in interaction rate
   - Conversation length (messages per session)
   - Task creation vs completion rate
   - Feature usage (calendar sync, recurring tasks)

### Monitoring Tools
- **CloudWatch** for EC2 and AWS metrics
- **MongoDB Atlas** built-in monitoring
- **Winston logs** with daily rotation
- Optional: **Sentry** (free tier) for error tracking

---

## Troubleshooting Guide

### Common Issues

**1. Container won't start:**
```bash
# Check logs
docker compose logs api

# Common causes:
# - Missing .env variables
# - MongoDB connection failure
# - Port already in use

# Solution:
docker compose down
docker compose up -d --build
```

**2. SSL certificate issues:**
```bash
# Renew certificate
sudo certbot renew

# Restart nginx
docker compose restart nginx
```

**3. MongoDB connection timeout:**
```bash
# Check if IP whitelisted in Atlas
# Verify connection string in .env
# Test connection:
mongo "mongodb+srv://cluster.mongodb.net/" --username your-user
```

**4. Claude API errors:**
```bash
# Check API key validity
# Monitor rate limits
# Verify account has credits
# Check logs for specific error messages
```

**5. Backup failures:**
```bash
# Check S3 permissions (IAM role attached to EC2)
# Verify disk space for mongodump
# Check backup script logs
tail -f /var/log/backup.log
```

---

## Future Enhancements (Post-MVP)

### Phase 6+ Ideas

1. **Analytics Dashboard:**
   - Completion trends over time
   - Time spent by category
   - Productivity insights
   - Goal tracking

2. **Collaboration Features:**
   - Share tasks with others
   - Team workspaces
   - Comments on tasks

3. **Integrations:**
   - Slack notifications
   - Todoist import
   - GitHub issue sync
   - Email → Task (forward email to create task)

4. **Advanced AI Features:**
   - AI tool use / function calling (create, update, complete, schedule tasks directly from chat)
   - Automatic task breakdown (large task → subtasks)
   - Smart rescheduling when you fall behind
   - Energy level tracking (suggest hard tasks when energized)
   - Voice interaction

5. **Mobile Native App:**
   - React Native version
   - Better offline support
   - Native notifications

6. **Gamification:**
   - Streaks for daily completions
   - Achievement badges
   - Productivity score

---

## Success Metrics

### How to measure success after launch

**Week 1:**
- Successfully authenticate with Google ✓
- Create and complete 5 tasks ✓
- Receive first morning check-in ✓

**Month 1:**
- 80%+ morning check-in engagement rate
- Average 10+ tasks completed per week
- Calendar sync working without manual intervention
- AI duration estimates within 20% of actual

**Month 3:**
- AI suggestions accepted 60%+ of the time
- Pattern learning shows clear user preferences
- Zero data loss (backups working)
- App usage becomes daily habit

---

## Current Implementation Status (as of 2026-02-22)

**Git:** Repo at `github.com/jcarcaso/to-do-agent`, `main` branch. CI/CD auto-deploys to EC2.
**Live URL:** `https://todo.drinkingwithskeletons.com`

### Phase 1: Foundation & Infrastructure — COMPLETE

**What was built:**
- Monorepo structure: `client/` (React + Vite + Tailwind) and `server/` (Express + Mongoose)
- Google OAuth 2.0 authentication (Passport.js) with JWT session cookies
- Docker configs: `docker-compose.yml` (production), `docker-compose.dev.yml` (dev)
- Dockerfiles for client, server, and nginx reverse proxy
- Winston logging (console + file)
- `.env.example` with all required variables

**What was skipped/deferred:**
- AWS EC2 deployment (1.2) — developing locally for now
- Docker not available on current macOS version — running server/client directly with `npm run dev`

### Phase 2: Core Task Management — COMPLETE

**What was built:**
- Task model (`server/src/models/Task.js`) — full schema with all attributes, recurrence, dependencies, AI fields, calendar fields
- Task CRUD API (`server/src/routes/tasks.js`) — create, list (filtering/sorting/pagination), get, update, soft delete, subtasks, status updates with dependency validation
- Dependency logic — circular detection, completion blocking, parent auto-update from subtasks
- Google Calendar integration (`server/src/services/calendar.js`, `server/src/routes/calendar.js`) — read events, schedule/reschedule/unschedule tasks
  - **Safety:** Events tagged with `extendedProperties.private.managedBy = "todo-agent-managed"` — app will NEVER modify/delete events it didn't create
  - Uses `calendar.events` scope (narrower than full `calendar` scope)
- Recurring tasks (`server/src/jobs/recurringTasks.js`) — daily cron + startup, supports daily/weekly/monthly, deduplication
- Frontend: TasksPage, TaskForm, TaskItem components, React Query hooks, API service layer
- Auth gating — unauthenticated users see sign-in prompt

**What was skipped/deferred:**
- Drag-and-drop task organization (React DnD)
- Frontend calendar view

### Phase 3: AI Agent Integration — COMPLETE

**What was built:**
- AI service (`server/src/services/ai.js`) — uses Claude CLI as subprocess via `--agent` and `--json-schema` flags
  - **Agent definition** (`.claude/agents/task-manager.md`) — version-controlled base system prompt, model (`haiku`), and tool config
  - **Structured output** — JSON schemas (`chatResponseSchema`, `titleSchema`, `estimateSchema`) enforce response shape via `--json-schema`, replacing fragile `[ACTION: {...}]` regex parsing
  - **Dynamic context** — `buildContextPrompt()` appends user tasks, calendar, patterns, and type-specific instructions via `--append-system-prompt`
  - **Auth:** Uses `CLAUDE_CODE_OAUTH_TOKEN` env var (from `claude setup-token`) — no separate API billing
  - **Important:** `ANTHROPIC_API_KEY` in `.env` must be set to placeholder value (or removed) — if present with a real key, Claude CLI will try to use it and fail
- Context builder — aggregates pending tasks, calendar events, user patterns, recent conversations
- System prompts tailored for: morning check-in, task planning, ad-hoc chat
- Conversation model (`server/src/models/Conversation.js`) — full message history with channel tracking
- Morning check-in system (`server/src/jobs/morningCheckIn.js`) — hourly cron matches user preferred time, Socket.io push notifications
- Pattern learning (`server/src/jobs/patternLearning.js`) — weekly job calculates completion rates, productive hours, duration accuracy
- UserPattern model (`server/src/models/UserPattern.js`)
- AI routes (`server/src/routes/ai.js`): chat, morning-checkin, plan-day, estimate-duration, list/get conversations
- Frontend chat page (`client/src/pages/ChatPage.jsx`) — message bubbles, "Morning Check-in" and "Plan My Day" buttons, conversation continuity

**What was skipped/deferred:**
- Email (SendGrid) and SMS (Twilio) channels
- Socket.io real-time chat streaming (currently uses request/response)

### Phase 4: Progressive Web App & Polish — COMPLETE

**What was built:**
- Mobile-responsive design — bottom nav for mobile, responsive grids, touch-friendly targets, safe-area handling
- Navigation fix — replaced `<a href>` with React Router `<NavLink>` (no more full page reloads)
- User settings page (`/settings`) — morning check-in time, timezone, notifications, phone number, theme selector
- User preferences API (`server/src/routes/user.js`) — GET/PUT `/api/user/preferences`
- Dark mode — `ThemeContext`, Tailwind `darkMode: 'class'`, `dark:` variants on all components, persisted to localStorage + server
- PWA — `manifest.json`, `favicon.svg`, `vite-plugin-pwa` with NetworkFirst caching for API routes, service worker auto-update
- Offline support — `OfflineIndicator` banner, React Query `networkMode: 'offlineFirst'`
- Error boundary — catches render errors with friendly reload UI
- Toast notifications — `ToastProvider` + `useToast()` hook, auto-dismiss, used on task delete/update and settings save
- Code splitting — `React.lazy` + `Suspense` for all page components
- Loading skeletons — pulse animation placeholders for task list and page loads
- Empty state improvements — icons + CTAs on TasksPage, quick-action suggestion buttons on ChatPage
- Keyboard shortcuts — `n` (new task), `/` (chat), `Escape` (close/blur)
- Task editing — clicking a task opens pre-populated edit form inline

**What was skipped/deferred:**
- Push notifications (browser Notification API)
- Swipe gestures
- Virtual scrolling for long task lists

### Phase 5: Backups, Monitoring & Launch — IN PROGRESS

**What was built:**
- Security hardening: Helmet CSP (custom directives, `useDefaults: false` for HTTP compatibility), express-mongo-sanitize, rate limiting (global, auth, AI), CORS whitelist
- Environment variable validation (`server/src/config/validateEnv.js`)
- Logging with Winston (console + daily rotation)
- Unit tests with Jest + Supertest + mongodb-memory-server

**What was skipped/deferred:**
- Automated S3 backups
- CloudWatch monitoring
- E2E tests
- Documentation (README, API docs)

### Phase 6: Deployment & CI/CD — COMPLETE (as of 2026-02-18)

**What was built:**
- **GitHub repo:** `github.com/jcarcaso/to-do-agent` on `main` branch
- **GitHub Actions CI/CD** (`.github/workflows/deploy.yml`):
  - **test** job: runs server tests (with MongoDB service container) + client build
  - **deploy** job: SSHs into EC2 via `appleboy/ssh-action`, pulls code, writes `.env` from secrets, runs deploy script
  - Triggers on every push to `main`
- **EC2 deployment** (Ubuntu, non-Docker):
  - Node.js 24 via nvm, PM2 process manager
  - Express serves both API and React static build from single process (`server/src/app.js`)
  - Apache reverse proxy with SSL termination (existing server at `drinkingwithskeletons.com`)
  - Subdomain: `todo.drinkingwithskeletons.com` → Apache vhost → `localhost:5000`
  - Let's Encrypt SSL via Certbot + Apache plugin
  - Deploy script (`deploy.sh`): git pull, client build, server install, PM2 restart, health check
- **Helmet configured for production HTTP/HTTPS:**
  - `useDefaults: false` with explicit CSP directives (no `upgrade-insecure-requests`)
  - HSTS and COOP disabled until HTTPS-only is enforced
  - `crossOriginResourcePolicy: cross-origin` for asset loading
- **VitePWA fix:** `navigateFallbackDenylist: [/^\/api\//]` to prevent service worker from intercepting API routes (OAuth redirect, etc.)
- **GitHub Secrets** required: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `ENV_FILE`

**Architecture (actual, replaces Docker/Nginx plan):**
```
Browser → https://todo.drinkingwithskeletons.com
    → Apache (SSL termination, reverse proxy)
        → localhost:5000 (Express + PM2)
            → API routes (/api/*)
            → Static React build (client/dist)
            → SPA catch-all (index.html)
        → MongoDB Atlas
        → Claude API
        → Google OAuth / Calendar API
```

**EC2 one-time setup performed:**
- Node.js 24 via nvm, PM2 globally installed
- Apache vhost for `todo.drinkingwithskeletons.com` with proxy + WebSocket support
- Let's Encrypt cert via `certbot --apache`
- PM2 startup + save for reboot persistence
- Security group: ports 22, 80, 443, 5000 open

### Key Files Reference

```
to-do-agent/
├── .env                            # Local config (NOT committed) — see .env.example
├── .env.example                    # Template with all required variables
├── .gitignore
├── .claude/agents/task-manager.md # AI agent definition (system prompt, model, tools)
├── project-plan.md                 # This file
├── deploy.sh                       # EC2 deployment script (git pull, build, pm2 restart)
├── .github/workflows/deploy.yml   # CI/CD: test + deploy to EC2 on push to main
├── docker-compose.yml              # Production (legacy — not used, using PM2 instead)
├── docker-compose.dev.yml          # Development (legacy — not used)
├── client/
│   ├── src/
│   │   ├── main.jsx                # Entry: React Query + Router + AuthProvider
│   │   ├── App.jsx                 # Shell layout, routing, auth gating
│   │   ├── context/AuthContext.jsx # Auth state, login/logout
│   │   ├── context/ThemeContext.jsx # Dark mode state + localStorage
│   │   ├── services/api.js         # API client (tasks, AI, auth, user)
│   │   ├── hooks/useTasks.js       # React Query hooks for task CRUD
│   │   ├── hooks/useKeyboardShortcuts.js # Global keyboard shortcuts
│   │   ├── pages/TasksPage.jsx     # Task list with filters + inline edit
│   │   ├── pages/ChatPage.jsx      # AI chat interface
│   │   ├── pages/SettingsPage.jsx  # User preferences
│   │   └── components/             # Header, Sidebar, BottomNav, TaskForm, TaskItem,
│   │                               # ErrorBoundary, Toast, LoadingSkeleton, OfflineIndicator
│   └── vite.config.js              # Dev proxy + vite-plugin-pwa
├── server/
│   ├── src/
│   │   ├── index.js                # Express + Socket.io + MongoDB + cron jobs
│   │   ├── config/passport.js      # Google OAuth strategy
│   │   ├── config/logger.js        # Winston
│   │   ├── middleware/auth.js      # JWT auth middleware
│   │   ├── models/                 # User, Task, Conversation, UserPattern
│   │   ├── routes/                 # auth, tasks, calendar, ai, user
│   │   ├── services/ai.js          # Claude CLI subprocess via --agent + --json-schema
│   │   ├── services/calendar.js    # Google Calendar (with safety guards)
│   │   └── jobs/                   # recurringTasks, morningCheckIn, patternLearning
│   └── package.json
└── nginx/
    ├── Dockerfile
    └── nginx.conf                  # Reverse proxy config
```

### Development Setup (to resume)

1. Ensure MongoDB Atlas is accessible (connection string in `.env`)
2. Terminal 1: `cd ~/dev/to-do-agent/server && npm run dev`
3. Terminal 2: `cd ~/dev/to-do-agent/client && npm run dev`
4. Open `http://localhost:5173`

**Known issues:**
- Docker Desktop cannot be installed (requires macOS upgrade) — run services directly
- Vite proxy must use `127.0.0.1` not `localhost` (IPv4/IPv6 mismatch)
- `ANTHROPIC_API_KEY` in `.env` must be placeholder — Claude CLI picks it up and rejects it if set to a real OAuth token
- Google Calendar token refresh works but calendar event fetch may warn on first load (tokens refresh automatically)

---

## Conclusion

This project plan provides a comprehensive roadmap to build your AI-powered personal task management system. The phased approach allows for iterative development while ensuring each component is production-ready before moving forward.

**Key Strengths of This Architecture:**
- Scalable (can handle growth)
- Cost-effective (<$25/month)
- Secure (OAuth, encrypted data)
- Intelligent (learns from your patterns)
- Flexible (multi-channel interaction)
- Reliable (automated backups, monitoring)

**Next Steps:**
1. Complete Phase 5: automated S3 backups, CloudWatch monitoring, E2E tests, documentation
2. Re-enable HSTS and COOP helmet headers now that HTTPS is live
3. Verify Google OAuth works end-to-end on production
4. Consider removing Docker configs (docker-compose.yml, Dockerfiles) since deployment uses PM2 directly
