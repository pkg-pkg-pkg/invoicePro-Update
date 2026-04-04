import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to fetch company details based on the logged-in user's companyId
export const getCompanyDetails = async (req: Request, res: Response) => {
    try {
        // Assuming the user's companyId is available through authentication middleware (req as any).user?.companyId)
        const authReq = req as any;
        const companyId = authReq.user?.companyId; 

        if (!companyId) {
            // This happens if the user is logged in but the company ID is missing from the token
            return res.status(404).json({ error: 'Company ID not found in user token.' });
        }

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            // Select all necessary fields
            select: {
                id: true,
                name: true,
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                pincode: true,
                mobile1: true,
                mobile2: true,
                email: true,
                website: true,
                gstin: true,
            }
        });

        if (!company) {
            return res.status(404).json({ error: 'Company details not found in database.' });
        }

        res.json({ success: true, company });
    } catch (error) {
        console.error('Error fetching company details:', error);
        res.status(500).json({ error: 'Failed to fetch company data due to server error.' });
    }
};

// You might need other functions like updateCompanyDetails, etc.
// export const updateCompanyDetails = async (req: Request, res: Response) => { /* ... */ };