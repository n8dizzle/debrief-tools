import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: "admin" | "tutor" | "parent";
      roles: ("admin" | "tutor" | "parent")[];
      isActive: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    roles?: string[];
    isActive?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    roles?: string[];
    isActive?: boolean;
  }
}
