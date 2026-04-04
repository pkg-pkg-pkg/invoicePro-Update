# Software Verification Checklist

## Pre-Flight Checks

### 1. Prerequisites ✅
- [ ] Node.js installed (v18+) - Check: `node --version`
- [ ] PostgreSQL installed and running - Check: `psql --version`
- [ ] Git installed - Check: `git --version`
- [ ] Dependencies installed - Run: `npm run install:all`

### 2. Database Setup ✅
- [ ] PostgreSQL is running
- [ ] Database `gst_billing` created
- [ ] Backend `.env` file exists with DATABASE_URL
- [ ] Prisma client generated - Run: `cd backend && npm run generate`
- [ ] Database migrations run - Run: `cd backend && npm run migrate`
- [ ] Seed data loaded (optional) - Run: `cd backend && npm run seed`

### 3. Backend Verification ✅
- [ ] Backend dependencies installed - `cd backend && npm install`
- [ ] Environment variables configured (`.env` file)
- [ ] Backend server starts - `cd backend && npm run dev`
- [ ] Health check works - Visit: `http://localhost:3000/health`
- [ ] API routes accessible

### 4. Desktop App Verification ✅
- [ ] Desktop dependencies installed - `cd desktop && npm install`
- [ ] Desktop app starts - `cd desktop && npm run electron:dev`
- [ ] Login screen loads
- [ ] Can login with test credentials

### 5. Basic Functionality Tests ✅
- [ ] Login works
- [ ] Dashboard loads
- [ ] Navigation works
- [ ] Products page loads
- [ ] Customers page loads
- [ ] Invoices page loads

---

## Quick Start Commands

### Step 1: Install Dependencies
```bash
# From project root
npm run install:all
```

### Step 2: Setup Database
```bash
# Create database (in PostgreSQL)
createdb gst_billing

# Or using psql
psql -U postgres
CREATE DATABASE gst_billing;
\q

# Generate Prisma client
cd backend
npm run generate

# Run migrations
npm run migrate

# (Optional) Seed data
npm run seed
```

### Step 3: Configure Backend
```bash
cd backend

# Create .env file if not exists
# Copy from SETUP.md or create with:
cat > .env << EOF
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/gst_billing?schema=public
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
EOF
```

### Step 4: Start Backend
```bash
cd backend
npm run dev
```

**Expected Output:**
```
🚀 Server running on port 3000
📡 WebSocket server ready at ws://localhost:3000/ws
```

### Step 5: Start Desktop App
```bash
# In a new terminal
cd desktop
npm run electron:dev
```

**Expected:**
- Electron window opens
- Login screen appears

---

## Test Credentials

After running seed script:
- **Username:** `admin`
- **Password:** `admin123`

Or register a new user via the registration endpoint.

---

## Verification Tests

### Test 1: Backend Health Check
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-06T..."
}
```

### Test 2: Backend Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Expected Response:**
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "...",
    "username": "admin",
    "role": "ADMIN"
  }
}
```

### Test 3: Protected Route (with token)
```bash
# Replace YOUR_TOKEN with actual token from login
curl http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** List of products (may be empty initially)

---

## Common Issues & Solutions

### Issue: Database Connection Error
**Error:** `Can't reach database server`
**Solution:**
1. Check PostgreSQL is running: `pg_isready`
2. Verify DATABASE_URL in `.env`
3. Check database exists: `psql -l | grep gst_billing`

### Issue: Prisma Client Not Generated
**Error:** `@prisma/client did not initialize yet`
**Solution:**
```bash
cd backend
npm run generate
```

### Issue: Migration Fails
**Error:** `Migration failed`
**Solution:**
```bash
cd backend
# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Or create fresh migration
npx prisma migrate dev --name init
```

### Issue: Desktop App Won't Start
**Error:** `Cannot find module` or build errors
**Solution:**
```bash
cd desktop
rm -rf node_modules
npm install
```

### Issue: Port Already in Use
**Error:** `Port 3000 is already in use`
**Solution:**
1. Find process: `netstat -ano | findstr :3000` (Windows) or `lsof -i :3000` (Mac/Linux)
2. Kill process or change PORT in `.env`

---

## Next Steps After Verification

Once everything is verified:

1. **Login to Desktop App**
   - Use test credentials or register new user
   - Explore dashboard

2. **Test Core Features**
   - Add a product
   - Add a customer
   - Create an invoice
   - View reports

3. **Check Documentation**
   - Review `docs/` folder for detailed guides
   - Check `API_DOCUMENTATION.md` for API endpoints
   - Review `SETUP.md` for detailed setup

---

## Status Check Script

Run this to check everything:

```bash
# Check Node.js
echo "Node.js: $(node --version)"

# Check PostgreSQL
echo "PostgreSQL: $(psql --version 2>/dev/null || echo 'Not found')"

# Check if backend .env exists
if [ -f "backend/.env" ]; then
  echo "✅ Backend .env exists"
else
  echo "❌ Backend .env missing"
fi

# Check if Prisma client generated
if [ -d "backend/node_modules/.prisma/client" ]; then
  echo "✅ Prisma client generated"
else
  echo "❌ Prisma client not generated"
fi

# Check if database is accessible (requires .env)
cd backend
if npm run generate > /dev/null 2>&1; then
  echo "✅ Database connection OK"
else
  echo "❌ Database connection failed"
fi
```

---

## Quick Verification Summary

✅ **All checks pass** → Software is ready to use!
❌ **Any check fails** → Follow the solutions above

For detailed setup instructions, see [SETUP.md](./SETUP.md)

