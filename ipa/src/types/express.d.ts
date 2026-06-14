import { JwtPayload } from 'jsonwebtoken';

export interface InvoiceProAuthUser extends JwtPayload {
  user_id: string;
  mobile_no?: string;
  is_child?: boolean;
  child_id?: string;
  parent_user_id?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: InvoiceProAuthUser;
    }
  }
}
