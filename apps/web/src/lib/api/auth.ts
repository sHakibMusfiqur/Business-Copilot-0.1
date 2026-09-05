import { api, setAccessToken, setAuthCookie } from './client';
import { API_ROUTES } from './routes';
import { resetAuthSession } from '@/lib/auth-session';

export async function login(email: string, password: string) {
  const response = await api.post(API_ROUTES.AUTH.LOGIN, { email, password });
  resetAuthSession();
  const { accessToken: token, user } = response.data;
  setAccessToken(token);
  setAuthCookie(token);
  return { user, accessToken: token };
}

export async function adminLogin(email: string, password: string) {
  const response = await api.post(API_ROUTES.AUTH.ADMIN_LOGIN, { email, password });
  resetAuthSession();
  const { accessToken: token, user } = response.data;
  setAccessToken(token);
  setAuthCookie(token);
  return { user, accessToken: token };
}

export async function register(name: string, email: string, password: string) {
const response = await api.post(API_ROUTES.AUTH.REGISTER, { name, email, password });
  resetAuthSession();
  return response.data as { email: string; message: string; emailSent: boolean };
}

export async function verifyEmail(token: string) {
  const response = await api.post(API_ROUTES.AUTH.VERIFY_EMAIL, { token });
  return response.data as { message: string };
}

export async function verifyEmailCode(email: string, code: string) {
  const response = await api.post(API_ROUTES.AUTH.VERIFY_EMAIL_CODE, { email, code });
  resetAuthSession();
  const { accessToken: token, user } = response.data;
  setAccessToken(token);
  setAuthCookie(token);
  return { user, accessToken: token };
}

export async function resendVerification(email: string) {
  const response = await api.post(API_ROUTES.AUTH.RESEND_VERIFICATION, { email });
  return response.data as { message: string };
}

export async function logout() {
  try {
    await api.post(API_ROUTES.AUTH.LOGOUT);
  } catch {
    // ignore server errors during logout
  } finally {
    resetAuthSession();
  }
}

export async function getMe(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.AUTH.ME, { signal });
  return response.data;
}

export async function createOrganization(name: string) {
  const response = await api.post(API_ROUTES.ORGANIZATIONS.ROOT, { name });
  return response.data;
}

export async function forgotPassword(email: string) {
  const response = await api.post(API_ROUTES.AUTH.FORGOT_PASSWORD, { email });
  return response.data;
}

export async function resetPassword(token: string, password: string) {
  const response = await api.post(API_ROUTES.AUTH.RESET_PASSWORD, { token, password });
  return response.data;
}
