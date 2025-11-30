# KumaView

A modern frontend dashboard for monitoring multiple Uptime Kuma instances, built with Next.js, shadcn/ui, and SQLite.

## Features

- **Multi-Source Support**: Monitor multiple Uptime Kuma instances from a single dashboard
- **Historical Data**: Store and track monitor history using SQLite
- **Real-time Sync**: Manually sync or schedule automatic data fetching
- **Beautiful UI**: Clean, responsive interface built with shadcn/ui components
- **Uptime Statistics**: View 24-hour and 30-day uptime percentages
- **Performance Metrics**: Track average ping times and monitor status

## Getting Started

### Prerequisites

- Node.js 18+ installed
- One or more Uptime Kuma instances with public status pages

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### First-Time Setup

1. Navigate to the Settings page (click the Settings button)
2. Add your first Uptime Kuma source:
   - **Name**: A friendly name for this instance (e.g., "Production Server")
   - **URL**: The base URL of your Uptime Kuma instance (e.g., `https://uptime.example.com`)
   - **API Key**: (Optional) If your instance requires authentication
3. Click "Add Source"
4. Click the sync button to fetch monitor data
5. Return to the dashboard to view your monitors

## Usage

### Dashboard

The main dashboard displays:
- Total monitor count
- Number of monitors up/down
- Individual monitor cards with:
  - Current status (Up/Down/Pending)
  - 24-hour and 30-day uptime percentages
  - Average ping time
  - Last check timestamp

### Settings Page

Manage your Uptime Kuma sources:
- **Add Source**: Add new Uptime Kuma instances
- **Edit Source**: Update existing source details
- **Delete Source**: Remove a source (also removes associated monitor data)
- **Sync**: Manually trigger data sync for a specific source

### Syncing Data

- **Manual Sync**: Click the "Sync All" button on the dashboard or individual sync buttons in Settings
- **Automatic Sync**: Use the scheduler API endpoint to enable periodic syncing (see API section)

## API Endpoints

### Sources Management
- `GET /api/sources` - List all sources
- `POST /api/sources` - Create a new source
- `GET /api/sources/[id]` - Get a specific source
- `PUT /api/sources/[id]` - Update a source
- `DELETE /api/sources/[id]` - Delete a source

### Monitors
- `GET /api/monitors` - List all monitors with statistics
- `GET /api/monitors/[id]/heartbeats` - Get heartbeat history for a monitor

### Sync
- `POST /api/sync` - Sync data from Uptime Kuma sources
  - Body: `{}` (sync all) or `{ "source_id": 1 }` (sync specific source)

### Scheduler
- `POST /api/scheduler` - Control automatic syncing
  - Start: `{ "action": "start", "interval": 5 }` (interval in minutes)
  - Stop: `{ "action": "stop" }`

## Database

KumaView uses SQLite to store:
- **uptime_kuma_sources**: Your configured Uptime Kuma instances
- **monitors**: Monitor information from each source
- **monitor_heartbeats**: Historical heartbeat data for uptime calculations

The database file is created automatically at `data/kumaview.db` on first run.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Database**: SQLite (better-sqlite3)
- **Icons**: Lucide React
- **Language**: TypeScript

## Building for Production

```bash
npm run build
npm start
```

## Notes

- The sync endpoint fetches data from Uptime Kuma's public status page API
- Historical data accumulates over time as you sync
- Uptime percentages are calculated from stored heartbeat data
- The scheduler runs in-memory and will need to be restarted after server restarts

## License

MIT