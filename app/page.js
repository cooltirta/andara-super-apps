import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  const cookieStore = await cookies();
  const emailCookie = cookieStore.get('user_email');
  if (emailCookie) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
