import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "employee" | "manager" | "owner";
      departmentId: string | null;
      isActive: boolean;
      permissions: Record<string, unknown> | null;
    } & DefaultSession["user"];
  }
}
