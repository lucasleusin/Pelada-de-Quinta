import { MatchStatus, Position, PresenceStatus, Team } from "@prisma/client";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email invalido."),
  password: z.string().min(6, "Senha deve ter no minimo 6 caracteres."),
});

export const playerCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatorio."),
  position: z.nativeEnum(Position),
  shirtNumberPreference: z.number().int().min(0).max(99).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const playerUpdateSchema = playerCreateSchema.partial().extend({
  name: z.string().trim().min(2).optional(),
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
  teamAScore: z.number().int().min(0).nullable(),
  teamBScore: z.number().int().min(0).nullable(),
});

export const confirmPresenceSchema = z.object({
  playerId: z.string().uuid(),
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
      goals: z.number().int().min(0),
      assists: z.number().int().min(0),
      goalsConceded: z.number().int().min(0),
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
        rating: z.number().int().min(0).max(5),
      }),
    )
    .min(1),
});
