import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "employee" | "manager" | "owner";
      departmentId: string | null;
      department: { id: string; name: string; slug: string } | null;
      isActive: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    departmentId?: string | null;
    department?: { id: string; name: string; slug: string } | null;
    isActive?: boolean;
  }
}
