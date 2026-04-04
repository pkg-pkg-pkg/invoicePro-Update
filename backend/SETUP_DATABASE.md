# Database Setup Instructions

## Step 1: Update .env File

Edit `backend/.env` and update the DATABASE_URL with your PostgreSQL credentials:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/gst_billing?schema=public
```

**Common Examples:**

If PostgreSQL username is `postgres` and password is `postgres`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gst_billing?schema=public
```

If PostgreSQL username is `postgres` and password is `admin`:
```
DATABASE_URL=postgresql://postgres:admin@localhost:5432/gst_billing?schema=public
```

## Step 2: Create Database

Open PostgreSQL (psql or pgAdmin) and run:

```sql
CREATE DATABASE gst_billing;
```

Or using command line:
```bash
psql -U postgres
CREATE DATABASE gst_billing;
\q
```

## Step 3: Run Migrations

```bash
cd backend
npm run migrate
```

## Step 4: (Optional) Seed Data

```bash
npm run seed
```

This creates:
- Admin user (username: `admin`, password: `admin123`)
- Sample company
- Sample data

## Troubleshooting

### Authentication Failed
- Check PostgreSQL is running
- Verify username and password in DATABASE_URL
- Try connecting with psql: `psql -U postgres -d postgres`

### Database Doesn't Exist
- Create it: `CREATE DATABASE gst_billing;`

### Port Issues
- Default PostgreSQL port is 5432
- If different, update in DATABASE_URL

