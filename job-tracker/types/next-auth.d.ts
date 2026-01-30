import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: 'employee' | 'manager' | 'owner';
      departmentId?: string | null;
      department?: {
        id: string;
        name: string;
        slug: string;
      } | null;
      isActive?: boolean;
      permissions?: Record<string, Record<string, boolean>> | null;
    };
  }

  interface User {
    id: string;
    role?: 'employee' | 'manager' | 'owner';
    departmentId?: string | null;
    isActive?: boolean;
    permissions?: Record<string, Record<string, boolean>> | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: 'employee' | 'manager' | 'owner';
    departmentId?: string | null;
    department?: {
      id: string;
      name: string;
      slug: string;
    } | null;
    isActive?: boolean;
    permissions?: Record<string, Record<string, boolean>> | null;
  }
}
