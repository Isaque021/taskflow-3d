import { expect, test } from "bun:test";
import { hashToken, normalizeEmail, parseDate, slugify } from "./utils";

test("normaliza e-mails para comparação consistente", () => {
  expect(normalizeEmail("  Pessoa@Exemplo.COM ")).toBe("pessoa@exemplo.com");
});

test("gera slugs legíveis para organizações", () => {
  expect(slugify("Minha Organização ")).toBe("minha-organizacao");
  expect(slugify("   ")).toBe("organizacao");
});

test("valida datas recebidas pela API", () => {
  expect(parseDate("2026-10-10T18:30:00.000Z")).toBeInstanceOf(Date);
  expect(parseDate("data inválida")).toBeNull();
});

test("produz hash estável para tokens de sessão", async () => {
  expect(await hashToken("token-de-teste")).toBe(await hashToken("token-de-teste"));
});
