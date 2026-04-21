declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        fullName?: string;
        role: 'ADMIN' | 'MANAGER' | 'SALESPERSON' | 'ACCOUNTANT' | 'STAFF' | 'USER';
        companyId?: string;
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