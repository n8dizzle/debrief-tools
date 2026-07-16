import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: 'employee' | 'manager' | 'owner';
      departmentId: string | null;
      isActive: boolean;
      permissions: Record<string, Record<string, boolean>> | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
    departmentId?: string | null;
    isActive?: boolean;
    permissions?: Record<string, Record<string, boolean>> | null;
  }
}
