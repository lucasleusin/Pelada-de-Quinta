import { MatchStatus, Position, PresenceStatus, Team } from "@prisma/client";
import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Usuario obrigatorio."),
  password: z.string().min(1, "Senha obrigatoria."),
});

const shirtNumberSchema = z.number().int().min(0).max(99).nullable().optional();

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.toLowerCase();
  },
  z.string().email("Email invalido.").max(120, "Email muito longo.").nullable().optional(),
);

const optionalPhoneSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  z
    .string()
    .min(8, "Telefone invalido.")
    .max(25, "Telefone invalido.")
    .regex(/^[0-9()+\-\s]+$/u, "Telefone invalido.")
    .nullable()
    .optional(),
);

export const playerCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatorio."),
  position: z.nativeEnum(Position),
  shirtNumberPreference: shirtNumberSchema,
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  isActive: z.boolean().optional(),
});

export const playerUpdateSchema = playerCreateSchema.partial().extend({
  name: z.string().trim().min(2).optional(),
});

export const playerProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Nome obrigatorio.").optional(),
    position: z.enum(["GOLEIRO", "ZAGUEIRO", "MEIA", "ATACANTE"]).optional(),
    shirtNumberPreference: shirtNumberSchema,
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export const activeToggleSchema = z.object({
  isActive: z.boolean(),
});

export const matchCreateSchema = z.object({
  matchDate: z.string().date("Data invalida."),
  location: z.string().trim().max(120).nullable().optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/u, "Hora deve estar no formato HH:mm.")
    .optional(),
  teamAName: z.string().trim().min(1).max(40).optional(),
  teamBName: z.string().trim().min(1).max(40).optional(),
});

export const matchUpdateSchema = matchCreateSchema.partial();

export const matchStatusSchema = z.object({
  status: z.nativeEnum(MatchStatus),
});

export const matchScoreSchema = z.object({
  teamAScore: z.number().int().min(0).max(99).nullable(),
  teamBScore: z.number().int().min(0).max(99).nullable(),
});

export const confirmPresenceSchema = z.object({
  playerId: z.string().uuid(),
});

export const publicPresenceSchema = z.object({
  playerId: z.string().uuid(),
  presenceStatus: z.enum(["CONFIRMED", "WAITLIST", "CANCELED"]),
});

export const participantsPresenceSchema = z.object({
  presenceStatus: z.nativeEnum(PresenceStatus),
});

export const teamsSchema = z.object({
  assignments: z.array(
    z.object({
      playerId: z.string().uuid(),
      team: z.nativeEnum(Team).nullable(),
    }),
  ),
});

export const statsBatchSchema = z.object({
  createdByPlayerId: z.string().uuid().optional(),
  stats: z.array(
    z.object({
      playerId: z.string().uuid(),
      goals: z.number().int().min(0).max(99),
      assists: z.number().int().min(0).max(99),
      goalsConceded: z.number().int().min(0).max(99),
      playedAsGoalkeeper: z.boolean().optional(),
    }),
  ),
});

export const ratingsBatchSchema = z.object({
  ratings: z
    .array(
      z.object({
        raterPlayerId: z.string().uuid(),
        ratedPlayerId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
      }),
    )
    .min(1),
});
