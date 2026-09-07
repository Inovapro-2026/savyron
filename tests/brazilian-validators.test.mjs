/**
 * TESTES: validadores brasileiros (CPF/CNPJ/telefone) — fonte única de regra.
 * Cobre os cenários do spec: dígitos verificadores, repetidos, tamanhos
 * inválidos, máscara, os valores exatos do bug e o padrão do backend.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const {
  validateBrazilianPhone,
  validateCPF,
  validateCNPJ,
  validateCPFOrCNPJ,
  normalizeBrazilianPhone,
} = await import("../packages/utils/src/validators.ts");

// ─── Valores exatos do bug ───
test("BUG: telefone 119781976455555 é REJEITADO", () => {
  assert.equal(validateBrazilianPhone("119781976455555"), false);
});
test("BUG: CPF/CNPJ 119781976451111 é REJEITADO", () => {
  assert.equal(validateCPFOrCNPJ("119781976451111"), false);
});
test("BUG: 119781976455555 falha também como documento", () => {
  assert.equal(validateCPFOrCNPJ("119781976455555"), false);
});

// ─── Telefone ───
const phoneOk = ["+55 (11) 97819-7645", "5511978197645", "(11) 97819-7645", "11978197645", "(45) 99851-0021", "(11) 3456-7890"];
for (const p of phoneOk) {
  test(`telefone VÁLIDO: ${p}`, () => assert.equal(validateBrazilianPhone(p), true));
}
const phoneBad = ["119781976455555", "1197819", "111111111111111", "000000000000000", "11abcde1234", "55119781976459999", "(00) 97819-7645", "5511978197645555"];
for (const p of phoneBad) {
  test(`telefone INVÁLIDO: ${p}`, () => assert.equal(validateBrazilianPhone(p), false));
}
test("normalização: (11) 97819-7645 → 5511978197645", () => {
  assert.equal(normalizeBrazilianPhone("(11) 97819-7645"), "5511978197645");
});
test("normalização: +5511978197645 → 5511978197645", () => {
  assert.equal(normalizeBrazilianPhone("+5511978197645"), "5511978197645");
});

// ─── CPF ───
test("CPF válido conhecido (111.444.777-35)", () => {
  assert.equal(validateCPF("111.444.777-35"), true);
});
test("CPF dígitos verificadores incorretos", () => {
  assert.equal(validateCPF("111.444.777-36"), false);
});
const cpfBad = ["1114447773", "111444777351", "abc11144477", "00000000000", "99999999999", "12345678900"];
for (const c of cpfBad) {
  test(`CPF INVÁLIDO: ${c}`, () => assert.equal(validateCPF(c), false));
}

// ─── CNPJ ───
test("CNPJ válido conhecido (11.222.333/0001-81)", () => {
  assert.equal(validateCNPJ("11.222.333/0001-81"), true);
});
test("CNPJ verificador incorreto", () => {
  assert.equal(validateCNPJ("11.222.333/0001-82"), false);
});
const cnpjBad = ["1122233300018", "112223330001811", "11111111111111", "00000000000000", "abcdefghijk123"];
for (const c of cnpjBad) {
  test(`CNPJ INVÁLIDO: ${c}`, () => assert.equal(validateCNPJ(c), false));
}

// ─── CPF/CNPJ misto ───
test("misto: 11 dígitos → CPF", () => {
  assert.equal(validateCPFOrCNPJ("11144477735"), true);
});
test("misto: 14 dígitos → CNPJ", () => {
  assert.equal(validateCPFOrCNPJ("11222333000181"), true);
});
test("misto: outros tamanhos → inválido", () => {
  assert.equal(validateCPFOrCNPJ("119781976451111"), false);
  assert.equal(validateCPFOrCNPJ("1234567890"), false);
});
