import { api } from './client';
import { API_ROUTES } from './routes';

export async function checkApiHealth(): Promise<void> {
  await api.get(API_ROUTES.HEALTH);
}
