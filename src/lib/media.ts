import { IMAGE_BASE_URL } from '@/services/api';

export const resolveImageUrl = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  return `${IMAGE_BASE_URL}${raw}`;
};
