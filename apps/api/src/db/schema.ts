// Esquema de BD del MVP (design.md — modelos de datos). Convenciones:
// - snake_case en columnas, tipos de dominio como enums de Postgres.
// - marking es APPEND-ONLY (REQ-MAR-02, constitution §4): el repositorio
//   nunca hace UPDATE/DELETE sobre ella; las correcciones van a
//   marking_correction. Endurecimiento con rol sin UPDATE/DELETE: task 3.5.
// - embedding usa pgvector (ADR-0007): columna vector(512), coseno con <=>.

import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  time,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const markingKindEnum = pgEnum("marking_kind", ["in", "out", "break_start", "break_end"]);
export const markingMethodEnum = pgEnum("marking_method", ["face", "pin"]);
export const appRoleEnum = pgEnum("app_role", ["admin", "supervisor"]);
export const faceSampleKindEnum = pgEnum("face_sample_kind", ["single", "average"]);

export const site = pgTable("site", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appUser = pgTable("app_user", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: appRoleEnum("role").notNull(),
  siteId: uuid("site_id").references(() => site.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employee = pgTable("employee", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  docType: text("doc_type").notNull().default("DNI"),
  docNumber: text("doc_number").notNull().unique(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => site.id),
  pinHash: text("pin_hash"),
  shiftStart: time("shift_start").notNull().default("09:00"),
  shiftEnd: time("shift_end").notNull().default("18:00"),
  active: boolean("active").notNull().default(true),
  /** consentimiento para tratamiento de datos biométricos (constitution §5, Ley 29733) */
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const faceSample = pgTable("face_sample", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employee.id),
  /** modelo generador: cambiar de modelo = re-enrolar (ADR-0002) */
  model: text("model").notNull().default("w600k_r50"),
  embedding: vector("embedding", { dimensions: 512 }).notNull(),
  kind: faceSampleKindEnum("kind").notNull().default("single"),
  active: boolean("active").notNull().default(true),
  sourcePhoto: text("source_photo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const device = pgTable("device", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => site.id),
  apiKeyHash: text("api_key_hash").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marking = pgTable(
  "marking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employee.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id),
    deviceId: uuid("device_id").references(() => device.id),
    kind: markingKindEnum("kind").notNull(),
    /** hora declarada del marcaje (del dispositivo si vino offline) */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    /** hora de recepción en el servidor — auditoría del delta offline */
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    method: markingMethodEnum("method").notNull(),
    similarity: real("similarity"),
    liveness: jsonb("liveness").$type<Record<string, number>>(),
    isOffline: boolean("is_offline").notNull().default(false),
    evidencePath: text("evidence_path"),
  },
  (t) => [index("marking_employee_occurred_idx").on(t.employeeId, t.occurredAt)],
);

export const markingCorrection = pgTable("marking_correction", {
  id: uuid("id").defaultRandom().primaryKey(),
  markingId: uuid("marking_id")
    .notNull()
    .references(() => marking.id),
  newKind: markingKindEnum("new_kind").notNull(),
  newOccurredAt: timestamp("new_occurred_at", { withTimezone: true }).notNull(),
  reason: text("reason").notNull(),
  byUserId: uuid("by_user_id").references(() => appUser.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companySettings = pgTable("company_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  ruc: text("ruc").notNull(),
  legalName: text("legal_name").notNull(),
  timezone: text("timezone").notNull().default("America/Lima"),
});
