# VXI TA Queue System

A real-time applicant queue management system for VXI Talent Acquisition teams. Features text-to-speech announcements and a big-screen live queue display.

## Features

- 🎯 **Admin Panel** - Add candidates, assign rooms, trigger TTS calls
- 📺 **Live Queue Display** - Big screen view with NOW CALLING section
- 🔊 **TTS Announcements** - Browser-based text-to-speech
- ⚙️ **Settings Management** - CRUD for Sites, Rooms, and Steps
- 🔄 **Real-time Updates** - Auto-refresh queue status

## Pages

| Route | Purpose |
|-------|---------|
| `/admin` | Queue management & candidate entry |
| `/live` | Big screen display for applicants |
| `/settings` | Configure sites, rooms, and recruitment steps |

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Express.js
- **Database:** SQLite (better-sqlite3)
- **TTS:** Web Speech API

## Local Development

```bash
# Install dependencies
npm install

# Run development (both client and server)
npm run dev

# Or run separately
npm run server  # Backend on port 3000
npm run client  # Frontend on port 5173
```

## Deploy to Railway

### Option 1: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Option 2: GitHub Integration

1. Push this repo to GitHub
2. Go to [Railway](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect and deploy

### Environment Variables (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `DATABASE_PATH` | ./queue.db | SQLite database path |

For persistent storage on Railway, you can mount a volume:
- Go to your service settings
- Add a volume mount at `/app/data`
- Set `DATABASE_PATH=/app/data/queue.db`

## API Endpoints

### Sites
- `GET /api/sites` - Get active sites
- `GET /api/sites/all` - Get all sites (including inactive)
- `POST /api/sites` - Create site
- `PUT /api/sites/:id` - Update site
- `DELETE /api/sites/:id` - Soft delete site

### Rooms
- `GET /api/rooms` - Get active rooms
- `GET /api/rooms/all` - Get all rooms
- `POST /api/rooms` - Create room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Soft delete room

### Steps
- `GET /api/steps` - Get active steps
- `GET /api/steps/all` - Get all steps
- `POST /api/steps` - Create step
- `PUT /api/steps/:id` - Update step
- `DELETE /api/steps/:id` - Soft delete step

### Queue
- `GET /api/queue` - Get queue (filter by site_id, status)
- `POST /api/queue` - Add to queue
- `PUT /api/queue/:id/call` - Mark as called
- `PUT /api/queue/:id/complete` - Mark as complete
- `DELETE /api/queue/:id` - Remove from queue

## Usage Tips

1. **Setup:** First configure Sites, Rooms, and Steps in Settings
2. **Admin:** Add candidates as they check in
3. **Live Display:** Open `/live` on a big screen TV
4. **Calling:** Click "Call" to trigger TTS announcement

## License

MIT - VXI Global Solutions
