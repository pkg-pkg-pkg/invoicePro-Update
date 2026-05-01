import api from './api';

export type MobileLoginResponse = {
  success: boolean;
  token: string;
  passwordChangeRequired?: boolean;
  user: {
    id: string;
    username: string;
    fullName?: string;
    mobileNumber?: string;
    role?: string;
    companyId?: string;
    mobilePermissions?: Record<string, unknown>;
  };
};

export async function mobileLogin(usernameOrMobile: string, password: string) {
  const response = await api.post<MobileLoginResponse>('/mobile/auth/login', {
    usernameOrMobile,
    password,
  });
  return response.data;
}

