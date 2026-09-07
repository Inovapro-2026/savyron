/**
 * VALIDADORES BRASILEIROS — CPF, CNPJ e Telefone/WhatsApp.
 *
 * Funções PURAS compartilhadas por frontend (cadastro) e backend (signup),
 * garantindo UMA única fonte de verdade para as regras:
 *  - CPF: 11 dígitos + dígitos verificadores (rejeita repetidos);
 *  - CNPJ: 14 dígitos + 2 dígitos verificadores (rejeita repetidos);
 *  - Telefone BR: DDD válido + celular 9 dígitos começando com 9 (aceita
 *    máscara, +55 opcional). Vazio é responsabilidade do chamador (opcional).
 */

/** Remove qualquer máscara (espaços, parênteses, hífen, ponto, +, barras). */
export function digitsOnly2(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

// ─────────────────────────────── CPF ───────────────────────────────

/** Valida CPF: 11 dígitos, não-repetido, dígitos verificadores corretos. */
export function validateCPF(input: string): boolean {
  const cpf = digitsOnly2(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 111.111.111-11 etc.
  // d1: soma dos 9 primeiros × (10..2) mod 11
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (Number(cpf[9]) !== d1) return false;
  // d2: soma dos 10 primeiros × (11..2) mod 11
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return Number(cpf[10]) === d2;
}

// ─────────────────────────────── CNPJ ───────────────────────────────

const CNPJ_WEIGHTS_D1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_D2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Valida CNPJ: 14 dígitos, não-repetido, 2 dígitos verificadores corretos. */
export function validateCNPJ(input: string): boolean {
  const cnpj = digitsOnly2(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // 11.111.../0001-11 etc.

  const calc = (len: number, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  if (calc(12, CNPJ_WEIGHTS_D1) !== Number(cnpj[12])) return false;
  return calc(13, CNPJ_WEIGHTS_D2) === Number(cnpj[13]);
}

/** 11 dígitos → valida como CPF; 14 → CNPJ; qualquer outro → inválido. */
export function validateCPFOrCNPJ(input: string): boolean {
  const digits = digitsOnly2(input);
  if (digits.length === 11) return validateCPF(digits);
  if (digits.length === 14) return validateCNPJ(digits);
  return false;
}

/** Mensagem amigável conforme a quantidade de dígitos. */
export function cpfCnpjErrorMessage(input: string): string {
  const digits = digitsOnly2(input);
  if (digits.length === 11) return "Digite um CPF válido.";
  if (digits.length === 14) return "Digite um CNPJ válido.";
  return "Digite um CPF ou CNPJ válido.";
}

// ──────────────────────────── TELEFONE ────────────────────────────

const VALID_BR_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46",
  "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

/**
 * Valida telefone/WhatsApp brasileiro (celular):
 *  - aceita máscara e +55 opcional;
 *  - formato: 55 + DDD(2) + 9 dígitos começando com 9;
 *  - DDD deve existir; rejeita sequências/repetições obviamente falsas.
 * Exemplos válidos: "5511978197645", "+55 (11) 97819-7645", "(11) 97819-7645".
 */
export function validateBrazilianPhone(input: string): boolean {
  let digits = digitsOnly2(input);
  if (digits.length < 10 || digits.length > 13) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // repetições
  if (digits.startsWith("55")) {
    const rest = digits.slice(2);
    if (rest.length === 10 || rest.length === 11) digits = rest;
  }
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = digits.slice(0, 2);
  if (!VALID_BR_DDDS.has(ddd)) return false;
  const number = digits.slice(2);
  // Fixo (10 dígitos totais: DDD + 8) OU celular (11: DDD + 9 começando com 9)
  if (digits.length === 10) {
    return !["0", "1"].includes(number[0]);
  }
  return number.startsWith("9") && !["0", "1"].includes(number[1]);
}

/** Normaliza para o padrão interno: 55 + DDD + número (só dígitos). */
export function normalizeBrazilianPhone(input: string): string {
  let digits = digitsOnly2(input);
  if (!digits.startsWith("55") || digits.length === 10 || digits.length === 11) {
    // sem código do país → adiciona
    digits = `55${digits}`;
  } else if (digits.startsWith("55") && digits.length > 13) {
    return digits; // inválido — chamador valida antes
  }
  return digits;
}
