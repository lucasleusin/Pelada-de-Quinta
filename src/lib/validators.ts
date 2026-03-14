import { MatchStatus, Position, PresenceStatus, Team, UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

const optionalNicknameSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  z.string().min(2, "Apelido invalido.").max(60, "Apelido muito longo.").nullable().optional(),
);

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email obrigatorio.").optional(),
  email: z.string().trim().min(1, "Email obrigatorio.").optional(),
  username: z.string().trim().min(1, "Email obrigatorio.").optional(),
  password: z.string().min(1, "Senha obrigatoria."),
}).transform((data) => ({
  identifier: (data.identifier ?? data.email ?? data.username ?? "").trim().toLowerCase(),
  password: data.password,
}));

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

const whatsAppPhoneSchema = z
  .string()
  .trim()
  .min(8, "Telefone invalido.")
  .max(25, "Telefone invalido.")
  .regex(/^[0-9()+\-\s]+$/u, "Telefone invalido.");

const siteOptionalTextSchema = (max: number, message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      return value.trim();
    },
    z.string().max(max, message),
  );

export const playerCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatorio."),
  nickname: optionalNicknameSchema,
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
    nickname: optionalNicknameSchema,
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

export const registrationSchema = z.object({
  name: z.string().trim().min(2, "Nome completo obrigatorio."),
  email: z.string().trim().toLowerCase().email("Email invalido."),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres."),
  nickname: optionalNicknameSchema,
  position: z.nativeEnum(Position).nullable().optional(),
  shirtNumberPreference: shirtNumberSchema,
  whatsApp: optionalPhoneSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalido."),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Token obrigatorio."),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres."),
});

export const changePasswordSchema = z.object({
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres."),
});

export const verificationTokenSchema = z.object({
  token: z.string().trim().min(1, "Token obrigatorio."),
});

export const approveRegistrationSchema = z
  .object({
    action: z.enum(["link", "create", "reject"]),
    playerId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "link" && !data.playerId) {
      ctx.addIssue({
        code: "custom",
        path: ["playerId"],
        message: "Selecione um jogador existente para vincular.",
      });
    }
  });

export const accountProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Nome completo obrigatorio.").optional(),
    nickname: optionalNicknameSchema,
    position: z.nativeEnum(Position).nullable().optional(),
    shirtNumberPreference: shirtNumberSchema,
    email: z.string().trim().toLowerCase().email("Email invalido.").optional(),
    whatsApp: optionalPhoneSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export const userRoleUpdateSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const userStatusUpdateSchema = z.object({
  action: z.enum(["disable", "reactivate", "reopen"]),
});

export const adminPasswordResetSchema = z.object({
  mode: z.enum(["email", "temporary"]),
});

export const accountStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
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
    z
      .object({
        playerId: z.string().uuid(),
        teams: z.array(z.nativeEnum(Team)).max(2).transform((teams) => Array.from(new Set(teams))),
        primaryTeam: z.nativeEnum(Team).nullable().optional(),
      })
      .refine(
        (value) => value.primaryTeam == null || value.teams.includes(value.primaryTeam),
        "Time principal precisa estar entre os times selecionados.",
      ),
  ),
});

export const statsBatchSchema = z.object({
  createdByPlayerId: z.string().uuid().optional(),
  stats: z.array(
    z.object({
      playerId: z.string().uuid(),
      teamAGoals: z.number().int().min(0).max(99),
      teamAAssists: z.number().int().min(0).max(99),
      teamAGoalsConceded: z.number().int().min(0).max(99),
      teamBGoals: z.number().int().min(0).max(99),
      teamBAssists: z.number().int().min(0).max(99),
      teamBGoalsConceded: z.number().int().min(0).max(99),
      playedAsGoalkeeper: z.boolean().optional(),
    }),
  ),
});

export const ratingsBatchSchema = z.object({
  ratings: z
    .array(
      z.object({
        raterPlayerId: z.string().uuid().optional(),
        ratedPlayerId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
      }),
    )
    .min(1),
});

export const whatsAppSettingsUpdateSchema = z.object({
  enabled: z.boolean(),
});

export const whatsAppRecipientCreateSchema = z.object({
  label: z.string().trim().min(1, "Nome obrigatorio.").max(80, "Nome muito longo."),
  phone: whatsAppPhoneSchema,
  isActive: z.boolean().optional(),
});

export const whatsAppRecipientUpdateSchema = whatsAppRecipientCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export const whatsAppTestSchema = z.object({
  recipientId: z.string().uuid(),
});

export const siteSettingsUpdateSchema = z.object({
  siteName: z.string().trim().min(1, "Nome do site obrigatorio.").max(80, "Nome do site muito longo."),
  siteShortName: z.string().trim().min(1, "Nome curto obrigatorio.").max(40, "Nome curto muito longo."),
  siteDescription: siteOptionalTextSchema(180, "Descricao muito longa."),
  locationLabel: siteOptionalTextSchema(80, "Localidade muito longa."),
  headerBadge: siteOptionalTextSchema(40, "Badge muito longo."),
});


