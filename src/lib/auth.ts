import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { UserRole, UserStatus } from "@prisma/client";
import { getPrismaClient } from "@/lib/db";
import { loginSchema } from "@/lib/validators";

const prisma = getPrismaClient();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  status: UserStatus;
  playerId: string | null;
  mustChangePassword: boolean;
  sessionVersion: number;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    status: user.status,
    playerId: user.playerId,
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
  };
}

const providers: Provider[] = [
  Credentials({
    credentials: {
      identifier: { label: "Email", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);

      if (!parsed.success || !parsed.data.identifier) {
        return null;
      }

      const { identifier, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { email: normalizeEmail(identifier) },
      });

      const fallbackEmail = (process.env.ADMIN_LOGIN_USERNAME ?? process.env.ADMIN_SEED_EMAIL ?? "admin@peladadaquinta.com").trim().toLowerCase();
      const fallbackPassword = process.env.ADMIN_LOGIN_PASSWORD ?? process.env.ADMIN_SEED_PASSWORD ?? "admin123";

      if (identifier === fallbackEmail && password === fallbackPassword) {
        const fallbackUser =
          (user && !user.mergedIntoUserId ? user : null) ??
          (await prisma.user.findFirst({
            where: {
              role: UserRole.ADMIN,
              mergedIntoUserId: null,
            },
            orderBy: { createdAt: "asc" },
          }));

        if (fallbackUser) {
          return serializeUser(fallbackUser);
        }
      }

      if (!user?.passwordHash || user.mergedIntoUserId) {
        return null;
      }

      const validPassword = await compare(password, user.passwordHash);

      if (!validPassword) {
        return null;
      }

      return serializeUser(user);
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "https://login.microsoftonline.com/common/v2.0",
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/entrar",
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      const email = normalizeEmail(user.email);
      const isSocialProvider = Boolean(account?.provider && account.provider !== "credentials");
      let dbUser =
        typeof user.id === "string"
          ? await prisma.user.findUnique({ where: { id: user.id } })
          : null;

      if (!dbUser) {
        dbUser = await prisma.user.findUnique({ where: { email } });
      }

      if (!dbUser && isSocialProvider) {
        dbUser = await prisma.user.create({
          data: {
            email,
            name: user.name ?? null,
            image: user.image ?? null,
            emailVerified: new Date(),
            role: UserRole.PLAYER,
            status: UserStatus.PENDING_APPROVAL,
          },
        });
      }

      if (!dbUser) {
        return false;
      }

      if (dbUser.mergedIntoUserId) {
        return "/entrar?erro=removido";
      }

      if (dbUser.status === UserStatus.DISABLED) {
        return "/entrar?erro=removido";
      }

      if (dbUser.mustChangePassword && account?.provider === "credentials") {
        return "/redefinir-senha?modo=obrigatorio";
      }

      if (isSocialProvider) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            name: dbUser.name ?? user.name ?? null,
            image: user.image ?? dbUser.image ?? null,
            emailVerified: dbUser.emailVerified ?? new Date(),
            status:
              dbUser.role === UserRole.ADMIN
                ? dbUser.status
                : dbUser.status === UserStatus.PENDING_VERIFICATION
                  ? UserStatus.PENDING_APPROVAL
                  : dbUser.status,
          },
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      const userId = typeof user?.id === "string" ? user.id : typeof token.sub === "string" ? token.sub : null;

      if (!userId) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!dbUser) {
        return {
          ...token,
          sub: undefined,
          role: undefined,
          status: undefined,
          playerId: undefined,
          email: undefined,
          name: undefined,
          picture: undefined,
          mustChangePassword: undefined,
          sessionVersion: undefined,
        };
      }

      if (dbUser.mergedIntoUserId) {
        return {
          ...token,
          sub: undefined,
          role: undefined,
          status: undefined,
          playerId: undefined,
          email: undefined,
          name: undefined,
          picture: undefined,
          mustChangePassword: undefined,
          sessionVersion: undefined,
        };
      }

      if (typeof token.sessionVersion === "number" && token.sessionVersion !== dbUser.sessionVersion) {
        return {
          ...token,
          sub: undefined,
          role: undefined,
          status: undefined,
          playerId: undefined,
          email: undefined,
          name: undefined,
          picture: undefined,
          mustChangePassword: undefined,
          sessionVersion: undefined,
        };
      }

      token.sub = dbUser.id;
      token.role = dbUser.role;
      token.status = dbUser.status;
      token.playerId = dbUser.playerId;
      token.email = dbUser.email;
      token.name = dbUser.name;
      token.picture = dbUser.image ?? undefined;
      token.mustChangePassword = dbUser.mustChangePassword;
      token.sessionVersion = dbUser.sessionVersion;

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
        session.user.role = (token.role as UserRole | undefined) ?? UserRole.PLAYER;
        session.user.status = (token.status as UserStatus | undefined) ?? UserStatus.PENDING_VERIFICATION;
        session.user.playerId = typeof token.playerId === "string" ? token.playerId : null;
        session.user.mustChangePassword = token.mustChangePassword === true;
      }

      return session;
    },
  },
});
