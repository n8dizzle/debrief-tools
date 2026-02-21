import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: "employee" | "manager" | "owner";
      departmentId: string | null;
      department: {
        id: string;
        name: string;
        slug: string;
      } | null;
      isActive: boolean;
      permissions: Record<string, any> | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role?: string;
    departmentId?: string;
    department?: {
      id: string;
      name: string;
      slug: string;
    };
    isActive?: boolean;
    permissions?: Record<string, any> | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    departmentId?: string | null;
    department?: {
      id: string;
      name: string;
      slug: string;
    } | null;
    isActive?: boolean;
    permissions?: Record<string, any> | null;
  }
}
