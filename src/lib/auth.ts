import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getPrismaClient } from "@/lib/db";
import { loginSchema } from "@/lib/validators";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const prisma = getPrismaClient();
        const admin = await prisma.adminUser.findUnique({ where: { email } });

        if (!admin) {
          return null;
        }

        const validPassword = await compare(password, admin.passwordHash);

        if (!validPassword) {
          return null;
        }

        return {
          id: admin.id,
          email: admin.email,
          name: "Administrador",
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.adminId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.adminId === "string") {
        session.user.id = token.adminId;
      }
      return session;
    },
  },
});
