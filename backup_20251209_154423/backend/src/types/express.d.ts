declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;  // ADD THIS LINE
        email: string;
        role: 'ADMIN' | 'MANAGER' | 'SALESPERSON' | 'ACCOUNTANT';
        companyId: string;
      };
      file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        destination: string;
        filename: string;
        path: string;
        size: number;
      };
    }
  }
}

export {};