# RocketChat Config Server

A comprehensive solution for integrating RocketChat with SuiteCRM, consisting of two main components:

- **rc-sync**: MongoDB synchronization watcher service
- **rcapiforsuitecrm**: RocketChat App for SuiteCRM integration

## 📁 Project Structure

```
rocketchat-configserver/
├── rc-sync/                    # Sync service
│   ├── package.json
│   └── sync-watcher.js        # Main sync watcher
└── rcapiforsuitecrm/          # RocketChat App
    ├── RcApiForSuiteCrmApp.ts # Main app file
    ├── app.json               # App configuration
    ├── endpoints/             # API endpoints
    │   ├── HelloWordEP.ts
    │   └── ScrmTokenEP.ts
    └── dist/                  # Build output
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v14+)
- MongoDB
- PM2 (for process management)
- RocketChat Server

### Installation

**Clone the repository**
```bash
git clone https://github.com/ThanhNhiet/RocketChat-ConfigServer4SuiteCRM.git
cd RocketChat-ConfigServer4SuiteCRM
```


## 🔧 RC-Sync Service

The synchronization service that watches for changes and syncs data with MongoDB.

### Setup & Run

```bash
cd rc-sync

# Install dependencies
npm install

# Install PM2 globally (if not already installed)
npm install -g pm2

# Start the sync service
pm2 start sync-watcher.js --name "rc-suitecrm-sync"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### PM2 Management Commands

```bash
# View logs
pm2 logs "rc-suitecrm-sync"

# List all processes
pm2 list

# Stop the service
pm2 stop "rc-suitecrm-sync"

# Restart the service
pm2 restart "rc-suitecrm-sync"

# Delete the service
pm2 delete "rc-suitecrm-sync"

# Monitor in real-time
pm2 monit
```

## 🚀 RocketChat App

A custom RocketChat application that provides API endpoints for SuiteCRM integration.

### Install

```bash
cd rcapiforsuitecrm

# Install dependencies
npm install
```

### Deployment

```bash
# Build package to install 
rc-apps package

# Deploy to RocketChat server
rc-apps deploy --url <your-rocketchat-url> --username <username> --password <password>
```