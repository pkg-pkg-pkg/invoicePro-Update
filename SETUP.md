# GST Billing Software - Setup Guide

## Prerequisites

### Required Software
1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
3. **Git** - [Download](https://git-scm.com/downloads)

### For Desktop Development
- **Windows 10/11** (for building Windows installer)
- **Visual Studio Build Tools** (for native modules)

### For Mobile Development
- **Android Studio** - [Download](https://developer.android.com/studio)
- **Java JDK 17+**
- **Android SDK** (API level 26+)

## Installation Steps

### 1. Clone and Install Dependencies

```bash
# Clone the repository (if applicable)
cd PVEB

# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### 2. Backend Setup

```bash
cd backend

# Create .env file from example
cp .env.example .env

# Edit .env file with your database credentials
# DATABASE_URL="postgresql://user:password@localhost:5432/gst_billing?schema=public"

# Generate Prisma Client
npm run generate

# Run database migrations
npm run migrate

# (Optional) Seed database with sample data
npm run seed

# Start development server
npm run dev
```

The backend API will be available at `http://localhost:3000`

### 3. Desktop Application Setup

```bash
cd desktop

# Install dependencies (if not done already)
npm install

# Start development server
npm run dev

# In another terminal, start Electron
npm run electron:dev
```

For production build:
```bash
npm run build:win
```

### 4. Mobile Application Setup

```bash
cd mobile

# Install dependencies
npm install

# For Android
npm run android

# For iOS (Mac only)
npm run ios
```

**Note:** Make sure Android emulator is running or device is connected before running `npm run android`.

## Database Setup

### PostgreSQL Configuration

1. Create a new database:
```sql
CREATE DATABASE gst_billing;
```

2. Update `backend/.env` with your database credentials:
```
DATABASE_URL="postgresql://username:password@localhost:5432/gst_billing?schema=public"
```

3. Run migrations:
```bash
cd backend
npm run migrate
```

## Environment Variables

### Backend (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gst_billing?schema=public

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS (Optional - Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

## Development Workflow

### Running All Services

1. **Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

2. **Terminal 2 - Desktop:**
```bash
cd desktop
npm run electron:dev
```

3. **Terminal 3 - Mobile (if needed):**
```bash
cd mobile
npm start
# Then in another terminal: npm run android
```

### Project Structure

```
PVEB/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── index.ts
│   └── prisma/
│       └── schema.prisma
├── desktop/          # Electron + React Desktop App
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   └── App.tsx
│   └── electron/
├── mobile/           # React Native Mobile App
│   └── src/
│       ├── screens/
│       ├── navigation/
│       └── store/
└── shared/           # Shared types and utilities
    └── src/
        ├── types/
        ├── utils/
        └── constants/
```

## Common Issues & Solutions

### Issue: Database connection error
**Solution:** 
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

### Issue: Electron build fails
**Solution:**
- Install Visual Studio Build Tools
- Run `npm run postinstall` in desktop folder

### Issue: Mobile app won't start
**Solution:**
- Check Android Studio is installed
- Verify Android SDK is configured
- Ensure emulator/device is connected

### Issue: Sync not working
**Solution:**
- Check backend API is running
- Verify network connectivity
- Check API endpoint in sync configuration

## Next Steps

1. **Configure Company Details:** Set up your company information in Settings
2. **Add Products:** Import or manually add products
3. **Add Customers/Suppliers:** Set up your party master data
4. **Create First Invoice:** Test the billing functionality
5. **Configure Sync:** Set up cloud sync for multi-device access

## Support

For issues or questions:
- Check the documentation in `/docs`
- Review error logs in console
- Contact support team

## License

Proprietary - All rights reserved

