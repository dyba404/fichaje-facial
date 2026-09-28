import { describe, expect, it } from "vitest";
import { MarkingKind, RecognizeResponse, SyncRequest } from "../src/index";

describe("contrato @recon/core", () => {
  it("parsea un RecognizeResponse válido", () => {
    const parsed = RecognizeResponse.parse({
      status: "recognized",
      employeeId: "0f0a7a6a-1111-4222-8333-444455556666",
      employeeName: "María Quispe",
      similarity: 0.61,
      ambiguous: false,
      requirePin: false,
      livenessScores: { eyeBlinkLeft: 0.91, yaw: 12.4 },
      latencyMs: 412,
    });
    expect(parsed.status).toBe("recognized");
  });

  it("rechaza un kind de marcaje desconocido", () => {
    expect(MarkingKind.safeParse("almuerzo").success).toBe(false);
  });

  it("valida el lote de sync offline y rechaza lotes vacíos", () => {
    const ok = SyncRequest.safeParse({
      items: [
        {
          pin: "1234",
          kind: "in",
          clientTime: "2026-09-28T13:05:00.000Z",
        },
      ],
    });
    expect(ok.success).toBe(true);

    const vacio = SyncRequest.safeParse({ items: [] });
    expect(vacio.success).toBe(false);
  });
});
