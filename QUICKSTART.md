# Quick Start Guide - GST Billing Software

## 🚀 Get Started in 5 Minutes

### Step 1: Install Prerequisites

```bash
# Check Node.js version (should be 18+)
node --version

# Install PostgreSQL and create database
# Windows: Download from postgresql.org
# Create database: CREATE DATABASE gst_billing;
```

### Step 2: Clone and Setup

```bash
# Navigate to project directory
cd PVEB

# Install all dependencies
npm install
cd backend && npm install
cd ../desktop && npm install
cd ../mobile && npm install
cd ../shared && npm install
```

### Step 3: Configure Backend

```bash
cd backend

# Create .env file
copy .env.example .env  # Windows
# or
cp .env.example .env    # Linux/Mac

# Edit .env and set your database URL:
# DATABASE_URL="postgresql://username:password@localhost:5432/gst_billing?schema=public"
# JWT_SECRET="your-secret-key-here"

# Generate Prisma client
npm run generate

# Run migrations
npm run migrate
```

### Step 4: Start Backend

```bash
cd backend
npm run dev
```

Backend will run on `http://localhost:3000`

### Step 5: Start Desktop App

```bash
# In a new terminal
cd desktop
npm run dev
```

Then in another terminal:
```bash
cd desktop
npm run electron:dev
```

### Step 6: Test the Application

1. Desktop app should open automatically
2. Login with default credentials (if seeded) or register new user
3. Navigate through the dashboard
4. Test creating a product, customer, and invoice

## 📱 Mobile App Setup (Optional)

```bash
cd mobile

# Make sure Android Studio is installed and emulator is running
npm run android
```

## 🔧 Common Commands

### Backend
```bash
cd backend
npm run dev          # Start development server
npm run migrate      # Run database migrations
npm run generate     # Generate Prisma client
npm run studio       # Open Prisma Studio (database GUI)
```

### Desktop
```bash
cd desktop
npm run dev          # Start Vite dev server
npm run electron:dev # Start Electron app
npm run build:win    # Build Windows installer
```

### Mobile
```bash
cd mobile
npm start            # Start Metro bundler
npm run android      # Run on Android
npm run ios          # Run on iOS (Mac only)
```

## 🐛 Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL in backend/.env
- Verify database exists: `psql -l` (should list gst_billing)

### Port Already in Use
- Backend: Change PORT in backend/.env
- Desktop: Change port in desktop/vite.config.ts

### Electron Won't Start
- Run `npm run postinstall` in desktop folder
- Check Node.js version (should be 18+)

### Mobile Build Fails
- Install Android Studio
- Set ANDROID_HOME environment variable
- Run `npx react-native doctor` to check setup

## 📚 Next Steps

1. **Read Documentation:**
   - [SETUP.md](./SETUP.md) - Detailed setup instructions
   - [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture

2. **Configure Your Business:**
   - Add company details in Settings
   - Set up GST information
   - Configure tax rates

3. **Add Master Data:**
   - Import or add products
   - Add customers and suppliers
   - Set up bank accounts

4. **Start Billing:**
   - Create your first invoice
   - Test payment collection
   - Generate reports

## 💡 Tips

- Use Prisma Studio to view/edit database: `cd backend && npm run studio`
- Check browser console (F12) for desktop app errors
- Use React Native Debugger for mobile debugging
- Enable auto-sync in settings for seamless data sync

## 🆘 Need Help?

- Check error messages in console
- Review logs in backend/desktop/mobile folders
- Consult documentation in `/docs` folder
- Contact support team

---

**Happy Billing! 🎉**

