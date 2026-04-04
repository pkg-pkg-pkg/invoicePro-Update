# Deployment Guide - Production Setup

## Table of Contents

1. [Cloud Infrastructure](#1-cloud-infrastructure)
2. [Backend Deployment](#2-backend-deployment)
3. [Desktop Deployment](#3-desktop-deployment)
4. [Mobile Deployment](#4-mobile-deployment)
5. [Environment Configuration](#5-environment-configuration)
6. [Monitoring & Backup](#6-monitoring--backup)

---

## 1. Cloud Infrastructure

### 1.1 Architecture

```
┌─────────────────────────────────────┐
│         Load Balancer (Nginx)       │
│         SSL Termination              │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│  Backend     │  │  Backend     │
│  Instance 1   │  │  Instance 2   │
│  (Node.js)   │  │  (Node.js)   │
└──────┬──────┘  └──────┬───────┘
       │                │
       └───────┬────────┘
               │
       ┌───────▼────────┐
       │   PostgreSQL    │
       │   (Primary)     │
       └───────┬────────┘
               │
       ┌───────▼────────┐
       │   PostgreSQL    │
       │  (Read Replica) │
       └─────────────────┘

┌─────────────────────────────────────┐
│         Redis Cache                 │
│    (Session + Cache + Queue)        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         S3 Bucket                   │
│      (Backups + Files)              │
└─────────────────────────────────────┘
```

### 1.2 Server Requirements

**Backend Server:**
- CPU: 2+ cores
- RAM: 4GB+
- Storage: 50GB+ SSD
- OS: Ubuntu 22.04 LTS

**Database Server:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 200GB+ SSD
- PostgreSQL 14+

---

## 2. Backend Deployment

### 2.1 Environment Setup

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Nginx
sudo apt-get install nginx
```

### 2.2 Database Setup

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE gst_billing;
CREATE USER gst_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE gst_billing TO gst_user;
\q

# Run migrations
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 2.3 Application Deployment

```bash
# Clone repository
git clone https://github.com/your-repo/gst-billing.git
cd gst-billing/backend

# Install dependencies
npm install --production

# Build TypeScript
npm run build

# Setup environment
cp .env.example .env
# Edit .env with production values

# Start with PM2
pm2 start dist/index.js --name gst-backend
pm2 save
pm2 startup
```

### 2.4 Nginx Configuration

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 2.5 Environment Variables

```env
# Production .env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://gst_user:password@localhost:5432/gst_billing
JWT_SECRET=<generate-secure-random-key>
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=<generate-secure-random-key>
REDIS_URL=redis://localhost:6379
S3_BUCKET=gst-billing-files
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

---

## 3. Desktop Deployment

### 3.1 Build Process

```bash
cd desktop

# Install dependencies
npm install

# Build React app
npm run build

# Build Electron
npm run build:electron

# Package for Windows
npm run pack:win

# Create installer
npm run dist:win
```

### 3.2 Auto-Update Setup

**Update Server Configuration:**
```json
{
  "publish": {
    "provider": "github",
    "owner": "your-username",
    "repo": "gst-billing-desktop"
  }
}
```

**Code Signing:**
- Obtain code signing certificate
- Configure in `electron-builder`
- Sign all releases

### 3.3 Distribution

- **Windows:** NSIS installer
- **Auto-update:** electron-updater
- **Version Management:** Semantic versioning

---

## 4. Mobile Deployment

### 4.1 Android Build

```bash
cd mobile

# Install dependencies
npm install

# Generate keystore
keytool -genkey -v -keystore android-release.keystore \
  -alias gst-billing -keyalg RSA -keysize 2048 -validity 10000

# Build release APK
npm run build:android:release

# Build AAB for Play Store
npm run build:android:bundle
```

### 4.2 Play Store Deployment

1. Create app in Google Play Console
2. Upload AAB file
3. Fill store listing
4. Submit for review
5. Enable in-app updates

---

## 5. Environment Configuration

### 5.1 Development

```env
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/gst_billing_dev
JWT_SECRET=dev-secret-key
API_PORT=3000
```

### 5.2 Staging

```env
NODE_ENV=staging
DATABASE_URL=postgresql://staging-db:5432/gst_billing_staging
JWT_SECRET=<staging-secret>
API_PORT=3000
```

### 5.3 Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://prod-db:5432/gst_billing
JWT_SECRET=<secure-random-256-bit-key>
API_PORT=3000
REDIS_URL=redis://prod-redis:6379
S3_BUCKET=gst-billing-prod
LOG_LEVEL=info
```

---

## 6. Monitoring & Backup

### 6.1 Health Checks

**Health Check Endpoint:**
```typescript
app.get('/health', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis (if used)
    // await redis.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});
```

### 6.2 Database Backup

**Automated Backup Script:**
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql"
S3_BUCKET="gst-billing-backups"

# Create backup
pg_dump -U gst_user gst_billing > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp ${BACKUP_FILE}.gz s3://${S3_BUCKET}/

# Delete local backup
rm ${BACKUP_FILE}.gz

# Delete backups older than 30 days
aws s3 ls s3://${S3_BUCKET}/ | while read -r line; do
  createDate=$(echo $line | awk {'print $1" "$2'})
  createDate=$(date -d "$createDate" +%s)
  olderThan=$(date -d "30 days ago" +%s)
  if [[ $createDate -lt $olderThan ]]; then
    fileName=$(echo $line | awk {'print $4'})
    aws s3 rm s3://${S3_BUCKET}/$fileName
  fi
done
```

**Cron Job:**
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup.sh
```

### 6.3 Logging

**Winston Configuration:**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### 6.4 Monitoring Tools

**Recommended:**
- **Uptime:** UptimeRobot, Pingdom
- **Errors:** Sentry
- **Performance:** New Relic, Datadog
- **Logs:** Loggly, Papertrail

---

## Summary

This deployment guide provides:

✅ **Cloud infrastructure** setup  
✅ **Backend deployment** steps  
✅ **Desktop deployment** process  
✅ **Mobile deployment** to Play Store  
✅ **Environment configuration** for all stages  
✅ **Monitoring and backup** strategies  

Follow these steps for a production-ready deployment.

