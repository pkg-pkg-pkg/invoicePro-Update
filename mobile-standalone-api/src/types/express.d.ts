import { JwtPayload } from 'jsonwebtoken';

export type AccessLevel = 'none' | 'read' | 'add' | 'add_edit' | 'full';
export type ModuleName =
  | 'sales'
  | 'purchase'
  | 'ledger'
  | 'receipts'
  | 'items'
  | 'customers'
  | 'reports';

export interface MobileAuthUser extends JwtPayload {
  user_id: string;
  mobile_no: string;
  is_child?: boolean;
  child_id?: string;
  parent_user_id?: string;
  permissions?: Partial<Record<ModuleName, AccessLevel>>;
}

declare global {
  namespace Express {
    interface Request {
      user?: MobileAuthUser;
      dataOwnerId?: string;
    }
  }
}
