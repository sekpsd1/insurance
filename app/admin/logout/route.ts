import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

async function clearAdminSession() {
  const cookieStore = await cookies();

  cookieStore.delete('admin_token');
  cookieStore.delete('admin_role');

  redirect('/admin/login');
}

export async function GET() {
  await clearAdminSession();
}

export async function POST() {
  await clearAdminSession();
}
