import { z } from "zod";

// ── Dominio ─────────────────────────────────────────────────────────────────

export const MarkingKind = z.enum(["in", "out", "break_start", "break_end"]);
export type MarkingKind = z.infer<typeof MarkingKind>;

export const MARKING_KIND_LABEL: Record<MarkingKind, string> = {
  in: "Entrada",
  out: "Salida",
  break_start: "Inicio refrigerio",
  break_end: "Fin refrigerio",
};

export const MarkingMethod = z.enum(["face", "pin"]);
export type MarkingMethod = z.infer<typeof MarkingMethod>;

export const Role = z.enum(["admin", "supervisor"]);
export type Role = z.infer<typeof Role>;

export const RecognitionStatus = z.enum(["recognized", "unknown", "capture_error"]);
export type RecognitionStatus = z.infer<typeof RecognitionStatus>;

/** Umbrales del pipeline CV (skill face-recog; el ajuste fino genera ADR — constitution §2). */
export const DEFAULT_THRESHOLDS = {
  /** similitud coseno mínima para aceptar el match */
  match: 0.38,
  /** segundo mejor ≥ este valor ⇒ ambigüedad ⇒ exigir PIN */
  ambiguous: 0.32,
} as const;

/** Enrolamiento: mínimo y máximo de muestras válidas por empleado (spec REQ-ENR-01). */
export const ENROLL_LIMITS = { min: 5, max: 10 } as const;

// ── Primitivas ──────────────────────────────────────────────────────────────

const Uuid = z.uuid();
const HhMm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
const Pin = z.string().regex(/^\d{4,6}$/, "PIN de 4 a 6 dígitos");
const IsoDatetime = z.iso.datetime({ offset: true });
const LivenessScores = z.record(z.string(), z.number());

// ── Auth ────────────────────────────────────────────────────────────────────

export const LoginRequest = z.object({
  email: z.email(),
  password: z.string().min(6),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SessionUser = z.object({
  id: Uuid,
  email: z.email(),
  role: Role,
  siteId: Uuid.nullable(),
});
export type SessionUser = z.infer<typeof SessionUser>;

// ── Sedes (REQ-SEDE) ────────────────────────────────────────────────────────

export const SiteCreate = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
});
export type SiteCreate = z.infer<typeof SiteCreate>;

export const SitePatch = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type SitePatch = z.infer<typeof SitePatch>;

export const Site = z.object({
  id: Uuid,
  name: z.string(),
  address: z.string().nullable(),
  active: z.boolean(),
  createdAt: IsoDatetime,
});
export type Site = z.infer<typeof Site>;

// ── Empleados (REQ-ENR) ─────────────────────────────────────────────────────

export const EmployeeCreate = z.object({
  fullName: z.string().min(3),
  /** DNI peruano: 8 dígitos */
  docNumber: z.string().regex(/^\d{8}$/, "DNI de 8 dígitos"),
  siteId: Uuid,
  pin: Pin.optional(),
  shiftStart: HhMm.default("09:00"),
  shiftEnd: HhMm.default("18:00"),
  /** consentimiento explícito para tratamiento de datos biométricos (constitution §5) */
  consent: z.literal(true),
});
export type EmployeeCreate = z.infer<typeof EmployeeCreate>;

export const EmployeePatch = z.object({
  fullName: z.string().min(3).optional(),
  siteId: Uuid.optional(),
  pin: Pin.nullable().optional(),
  shiftStart: HhMm.optional(),
  shiftEnd: HhMm.optional(),
  active: z.boolean().optional(),
});
export type EmployeePatch = z.infer<typeof EmployeePatch>;

export const Employee = z.object({
  id: Uuid,
  fullName: z.string(),
  docNumber: z.string(),
  siteId: Uuid,
  shiftStart: z.string(),
  shiftEnd: z.string(),
  active: z.boolean(),
  faceEnrolled: z.boolean(),
  createdAt: IsoDatetime,
});
export type Employee = z.infer<typeof Employee>;

/** Estado del enrolamiento facial de un empleado. */
export const EnrollStatus = z.object({
  employeeId: Uuid,
  validSamples: z.number().int().nonnegative(),
  minRequired: z.number().int(),
  maxAllowed: z.number().int(),
  canFinalize: z.boolean(),
});
export type EnrollStatus = z.infer<typeof EnrollStatus>;

// ── Marcajes (REQ-REC, REQ-LIV, REQ-MAR) ────────────────────────────────────

/** Respuesta de POST /marks/recognize (el kiosco envía el frame como multipart). */
export const RecognizeResponse = z.object({
  status: RecognitionStatus,
  employeeId: Uuid.nullable(),
  employeeName: z.string().nullable(),
  /** similitud coseno del top-1 (null si capture_error) */
  similarity: z.number().nullable(),
  /** segundo mejor ≥ umbral de ambigüedad ⇒ el kiosco debe exigir PIN */
  ambiguous: z.boolean(),
  requirePin: z.boolean(),
  livenessScores: LivenessScores.nullable(),
  latencyMs: z.number().int().nonnegative(),
});
export type RecognizeResponse = z.infer<typeof RecognizeResponse>;

/** POST /marks/pin — el PIN identifica al empleado (fallback REQ-REC-02). */
export const PinMarkRequest = z.object({
  pin: Pin,
  kind: MarkingKind,
  /** hora del dispositivo; si falta, usa la del servidor */
  clientTime: IsoDatetime.optional(),
  livenessScores: LivenessScores.optional(),
});
export type PinMarkRequest = z.infer<typeof PinMarkRequest>;

export const MarkingResult = z.object({
  id: Uuid,
  employeeId: Uuid,
  employeeName: z.string(),
  kind: MarkingKind,
  occurredAt: IsoDatetime,
  receivedAt: IsoDatetime,
  method: MarkingMethod,
  similarity: z.number().nullable(),
  isOffline: z.boolean(),
  evidenceUrl: z.string(),
});
export type MarkingResult = z.infer<typeof MarkingResult>;

/** POST /marks/sync — cola offline del kiosco (REQ-MAR-03). Solo método PIN:
 *  el reconocimiento facial es server-side y no puede correr sin red.
 *  Cada item lleva su foto de evidencia (constitution §4: todo marcaje
 *  guarda foto — también offline). */
export const SyncRequest = z.object({
  items: z
    .array(
      z.object({
        pin: Pin,
        kind: MarkingKind,
        clientTime: IsoDatetime,
        livenessScores: LivenessScores.optional(),
        /** filename del archivo multipart con la foto de evidencia del item */
        photo: z.string().optional(),
      }),
    )
    .min(1)
    .max(200),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export const SyncResponse = z.object({
  accepted: z.number().int().nonnegative(),
  rejected: z.array(z.object({ index: z.number().int(), reason: z.string() })),
});
export type SyncResponse = z.infer<typeof SyncResponse>;

// ── Dashboard (REQ-DASH) ────────────────────────────────────────────────────

export const SiteSummary = z.object({
  siteId: Uuid.nullable(),
  siteName: z.string(),
  present: z.number().int().nonnegative(),
  late: z.number().int().nonnegative(),
  absent: z.number().int().nonnegative(),
});
export type SiteSummary = z.infer<typeof SiteSummary>;

export const SummaryResponse = z.object({
  date: z.string(),
  sites: z.array(SiteSummary),
});
export type SummaryResponse = z.infer<typeof SummaryResponse>;

/** Ítem del feed en vivo (SSE /events) — también fila de la tabla de empleados. */
export const FeedItem = z.object({
  id: Uuid,
  employeeId: Uuid,
  employeeName: z.string(),
  siteId: Uuid,
  siteName: z.string(),
  kind: MarkingKind,
  occurredAt: IsoDatetime,
  method: MarkingMethod,
  similarity: z.number().nullable(),
  isOffline: z.boolean(),
  evidenceUrl: z.string(),
});
export type FeedItem = z.infer<typeof FeedItem>;

// ── Reportes (REQ-REP) ──────────────────────────────────────────────────────

export const ReportQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM"),
  siteId: Uuid.optional(),
  employeeId: Uuid.optional(),
});
export type ReportQuery = z.infer<typeof ReportQuery>;

// ── Kioscos (dispositivos) ──────────────────────────────────────────────────

export const DeviceRegister = z.object({
  name: z.string().min(1),
  siteId: Uuid,
});
export type DeviceRegister = z.infer<typeof DeviceRegister>;

export const Device = z.object({
  id: Uuid,
  name: z.string(),
  siteId: Uuid,
  lastSeenAt: IsoDatetime.nullable(),
});
export type Device = z.infer<typeof Device>;
