# To-Do Agent

An AI-powered task management application with Google Calendar integration, smart scheduling, and natural language chat powered by Claude.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, PWA
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB with Mongoose
- **AI**: Claude CLI (Anthropic)
- **Auth**: Google OAuth 2.0, JWT
- **Calendar**: Google Calendar API

## Project Structure

```
├── client/               # React frontend (Vite)
│   └── src/
│       ├── components/   # React components
│       ├── context/      # Auth & theme context
│       └── pages/        # Page components
├── server/               # Express API server
│   ├── src/
│   │   ├── config/       # Logger, passport, env validation
│   │   ├── middleware/    # Auth, rate limiting
│   │   ├── models/       # Mongoose models (Task, User, Conversation, UserPattern)
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # AI service, calendar, task helpers
│   │   ├── jobs/         # Cron jobs (recurring tasks, morning check-in, pattern learning)
│   │   ├── app.js        # Express app setup (middleware, routes)
│   │   └── index.js      # Server entry point (DB, socket.io, cron)
│   └── tests/            # Jest test suite
│       ├── unit/         # Unit tests
│       └── integration/  # Integration tests
├── nginx/                # Nginx configuration
└── docker-compose.yml    # Docker deployment
```

## Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- Google Cloud project with OAuth 2.0 credentials
- Claude CLI (for AI features)

## Development Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repo-url>
   cd to-do-agent
   cd server && npm install
   cd ../client && npm install
   ```

2. **Configure environment variables** — create a `.env` file in the project root:

   | Variable | Required | Description |
   |---|---|---|
   | `MONGODB_URI` | Yes | MongoDB connection string |
   | `JWT_SECRET` | Yes | Secret for JWT signing (must not be a placeholder) |
   | `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
   | `GOOGLE_CALLBACK_URL` | Yes | Google OAuth redirect URI |
   | `CLIENT_URL` | Yes | Frontend URL (e.g., `http://localhost:5173`) |
   | `PORT` | No | Server port (default: 5000) |
   | `NODE_ENV` | No | `development` or `production` |
   | `LOG_LEVEL` | No | Winston log level (default: `info`) |
   | `CLAUDE_CODE_OAUTH_TOKEN` | No | OAuth token for Claude CLI (AI features) |

3. **Start the development servers**:
   ```bash
   # Terminal 1: API server
   cd server && npm run dev

   # Terminal 2: Frontend
   cd client && npm run dev
   ```

4. Open `http://localhost:5173` and sign in with Google.

## Running Tests

```bash
cd server
npm test
```

Tests use `mongodb-memory-server` — no running MongoDB instance required.

## Features

- **Task Management**: Full CRUD with subtasks, dependencies, priorities, due dates, and recurring tasks
- **AI Chat**: Natural language task management via Claude
- **Smart Scheduling**: AI-powered duration estimates and daily planning
- **Google Calendar**: Sync tasks with Google Calendar events
- **Morning Check-In**: Daily AI-generated briefings on upcoming tasks
- **Pattern Learning**: Learns from task completion patterns to improve estimates
- **Dark Mode**: System-aware theme with manual toggle
- **PWA**: Installable progressive web app with offline support
- **Real-time Updates**: Socket.io for live notifications

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check |
| GET | `/api/auth/google` | No | Initiate Google OAuth |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/auth/logout` | No | Clear auth cookie |
| GET | `/api/tasks` | Yes | List tasks (filter, sort, paginate) |
| POST | `/api/tasks` | Yes | Create task |
| GET | `/api/tasks/:id` | Yes | Get single task |
| PUT | `/api/tasks/:id` | Yes | Update task |
| DELETE | `/api/tasks/:id` | Yes | Archive task |
| PUT | `/api/tasks/:id/status` | Yes | Update status with dependency check |
| POST | `/api/tasks/:id/subtasks` | Yes | Add subtask |
| POST | `/api/ai/chat` | Yes | Send message to AI |
| POST | `/api/ai/morning-checkin` | Yes | Trigger morning check-in |
| POST | `/api/ai/plan-day` | Yes | Get AI daily plan |
| GET | `/api/user/preferences` | Yes | Get preferences |
| PUT | `/api/user/preferences` | Yes | Update preferences |
| GET | `/api/calendar/events` | Yes | List calendar events |
| POST | `/api/calendar/sync/:taskId` | Yes | Sync task to calendar |

## Security

- Helmet.js for HTTP security headers
- CORS with whitelisted origin
- Rate limiting (global: 100/15min, auth: 10/15min, AI: 20/15min)
- NoSQL injection prevention via express-mongo-sanitize
- HTTP-only JWT cookies
- Environment variable validation on startup
- Winston log rotation (14-day retention)
