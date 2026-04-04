# Quick Fix for Blank Screen

## Issue
The browser shows a blank white page at `localhost:5173` or `localhost:5174`.

## Solutions

### Option 1: Use the Correct Port
The Vite dev server is running on **port 5174** (because 5173 was busy).

**In your browser, change the URL to:**
```
http://localhost:5174
```

### Option 2: Free Port 5173
If you want to use port 5173:

1. Find what's using port 5173:
   ```powershell
   netstat -ano | findstr :5173
   ```

2. Kill that process (replace PID with the actual process ID):
   ```powershell
   taskkill /PID <PID> /F
   ```

3. Restart the dev server:
   ```powershell
   cd desktop
   npm run dev
   ```

### Option 3: Check Browser Console
1. Open browser DevTools (F12)
2. Check the Console tab for errors
3. Check the Network tab to see if files are loading

### Option 4: Clear Browser Cache
1. Press Ctrl+Shift+Delete
2. Clear cached images and files
3. Reload the page (Ctrl+R)

## Expected Result
You should see the **Login Screen** with:
- Username field
- Password field
- Login button
- "GST Billing Software" title

## If Still Blank
1. Check terminal for Vite errors
2. Verify `desktop/src/main.tsx` exists
3. Verify `desktop/index.html` exists
4. Check browser console for JavaScript errors

## Test Backend
Make sure backend is running:
```powershell
cd backend
npm run dev
```

Then test: http://localhost:3000/health

