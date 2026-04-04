// D:\PVEB\backend\src\routes\company.ts - FIXED MODULE EXPORT

import { Router } from 'express';
import { getCompanyDetails } from '../controllers/company'; // Import the controller logic
// Note: Authentication middleware is typically applied in the index.ts file for all protected routes, 
// but we'll include it here for direct use on the route as a fallback.
// import { authenticate } from '../middleware/auth'; // Assuming you have this middleware

const router = Router();

// Route to get the logged-in user's company details
// The authentication middleware must be applied before this route is reached.
// Example route: GET /api/company
router.get('/', getCompanyDetails);

// **********************************
// **** FIX: Export the router ****
// This line fixes the "is not a module" error.
export default router; 
// **********************************