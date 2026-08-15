import { NextRequest } from 'next/server';
import { POST as login } from './login/route';
import { GET as me } from './me/route';

// Alias tương thích; client mới dùng /api/auth/login và /api/auth/me.
export async function POST(request: NextRequest) {
  return login(request);
}

export async function GET(request: NextRequest) {
  return me(request);
}
