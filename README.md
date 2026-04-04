# GST Billing Software

Complete offline-first billing software with desktop (Windows) and mobile (Android) applications, featuring full GST compliance, inventory management, and real-time sync.

## Project Structure

```
PVEB/
├── desktop/          # Windows Desktop App (Electron + React + TypeScript)
├── mobile/           # Android Mobile App (React Native + TypeScript)
├── backend/          # Cloud Backend API (Node.js + Express + PostgreSQL)
├── shared/           # Shared types, utilities, and business logic
├── docs/             # Documentation
└── scripts/          # Build and deployment scripts
```

## Technology Stack

### Desktop Application
- **Framework:** Electron
- **Frontend:** React + TypeScript
- **UI Library:** Material-UI / Ant Design
- **Database:** SQLite (offline)
- **State Management:** Redux Toolkit / Zustand
- **Charts:** Recharts / Chart.js

### Mobile Application
- **Framework:** React Native
- **Language:** TypeScript
- **UI Library:** React Native Paper / NativeBase
- **Database:** SQLite (offline)
- **State Management:** Redux Toolkit / Zustand
- **Navigation:** React Navigation

### Backend API
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma / TypeORM
- **Authentication:** JWT
- **File Storage:** AWS S3 / Local storage

## Features

### Core Features
- ✅ Offline-first architecture
- ✅ Two-way sync (Desktop ↔ Cloud ↔ Mobile)
- ✅ Complete GST compliance (GSTR-1, GSTR-2, GSTR-3B, GSTR-9)
- ✅ Invoice management (Sales, Purchase, Credit/Debit Notes)
- ✅ Inventory management with stock tracking
- ✅ Party management (Customers, Suppliers)
- ✅ Payment and banking
- ✅ Comprehensive dashboard with analytics
- ✅ 50+ reports with export options
- ✅ Multi-user with role-based access
- ✅ SMS/Email/WhatsApp integration
- ✅ Barcode support
- ✅ Cloud backup

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL 14+
- Android Studio (for mobile development)
- Git

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd PVEB
```

2. Install dependencies
```bash
# Desktop
cd desktop && npm install

# Mobile
cd mobile && npm install

# Backend
cd backend && npm install
```

3. Set up environment variables
```bash
# Copy example env files and configure
cp backend/.env.example backend/.env
```

4. Run database migrations
```bash
cd backend && npm run migrate
```

5. Start development servers
```bash
# Backend
cd backend && npm run dev

# Desktop
cd desktop && npm run dev

# Mobile
cd mobile && npm start
```

## Development Phases

### Phase 1: Foundation (Week 1-2)
- Project setup and structure
- Database schema design
- Authentication and user management
- Basic UI framework

### Phase 2: Core Modules (Week 3-6)
- GST features implementation
- Billing module
- Inventory management
- Party management

### Phase 3: Advanced Features (Week 7-10)
- Dashboard and analytics
- Reports module
- Sync mechanism
- Payment and banking

### Phase 4: Integration & Polish (Week 11-12)
- SMS/Email/WhatsApp integration
- Printing features
- Mobile app optimization
- Testing and bug fixes

## License

Proprietary - All rights reserved

## Support

For queries and support, contact: [Your Contact Details]

