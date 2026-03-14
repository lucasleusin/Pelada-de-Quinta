import { createHash, randomBytes } from "crypto";
import { getPrismaClient } from "@/lib/db";

const TOKEN_TTL_MINUTES = {
  verify: 60 * 24,
  reset: 60,
} as const;

type TokenPurpose = keyof typeof TOKEN_TTL_MINUTES;

const db = () => getPrismaClient();

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function identifierFor(purpose: TokenPurpose, userId: string) {
  return `${purpose}:${userId}`;
}

export async function createUserActionToken(userId: string, purpose: TokenPurpose) {
  const rawToken = randomBytes(32).toString("hex");
  const token = hashToken(rawToken);
  const expires = new Date(Date.now() + TOKEN_TTL_MINUTES[purpose] * 60 * 1000);
  const identifier = identifierFor(purpose, userId);

  await db().verificationToken.deleteMany({
    where: {
      identifier,
    },
  });

  await db().verificationToken.create({
    data: {
      identifier,
      token,
      expires,
    },
  });

  return {
    rawToken,
    expires,
  };
}

export async function consumeUserActionToken(rawToken: string, purpose: TokenPurpose) {
  const token = hashToken(rawToken);
  const verificationToken = await db().verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken) {
    return null;
  }

  const [tokenPurpose, userId] = verificationToken.identifier.split(":");

  if (tokenPurpose !== purpose || !userId) {
    return null;
  }

  if (verificationToken.expires.getTime() < Date.now()) {
    await db().verificationToken.delete({ where: { token } }).catch(() => undefined);
    return null;
  }

  await db().verificationToken.delete({ where: { token } });

  return {
    userId,
  };
}
