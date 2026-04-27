import 'next-auth';
import type { Department, UserRole } from '.';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      department: Department | null;
      homeWarehouseId: string | null;
      assignedTruckId: string | null;
      isActive: boolean;
      firstName: string;
      lastName: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: UserRole;
    department?: Department | null;
    homeWarehouseId?: string | null;
    assignedTruckId?: string | null;
    isActive?: boolean;
    firstName?: string;
    lastName?: string;
  }
}
