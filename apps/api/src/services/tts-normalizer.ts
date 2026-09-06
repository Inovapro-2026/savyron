/**
 * Normalizador de texto para TTS — converte abreviações, valores monetários,
 * porcentagens, datas e horários para linguagem natural falada.
 *
 * A interface continua exibindo o formato convencional (ex.: "R$ 50,00").
 * Apenas o texto enviado ao TTS é normalizado.
 */

const NUMBERS: Record<string, string> = {
  "0": "zero", "1": "um", "2": "dois", "3": "três", "4": "quatro",
  "5": "cinco", "6": "seis", "7": "sete", "8": "oito", "9": "nove",
  "10": "dez", "11": "onze", "12": "doze", "13": "treze", "14": "catorze",
  "15": "quinze", "16": "dezesseis", "17": "dezessete", "18": "dezoito", "19": "dezenove",
  "20": "vinte", "30": "trinta", "40": "quarenta", "50": "cinquenta",
  "60": "sessenta", "70": "setenta", "80": "oitenta", "90": "noventa",
  "100": "cem", "200": "duzentos", "300": "trezentos", "400": "quatrocentos",
  "500": "quinhentos", "600": "seiscentos", "700": "setecentos", "800": "oitocentos", "900": "novecentos",
};

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function numberToWords(n: number): string {
  if (n === 0) return "zero";
  if (n < 0) return "menos " + numberToWords(Math.abs(n));

  if (n <= 20) return NUMBERS[String(n)] ?? String(n);
  if (n < 100) {
    const d = Math.floor(n / 10) * 10;
    const u = n % 10;
    return NUMBERS[String(d)] + (u > 0 ? " e " + NUMBERS[String(u)] : "");
  }
  if (n < 1000) {
    const c = Math.floor(n / 100) * 100;
    const r = n % 100;
    const prefix = c === 100 ? "cento" : NUMBERS[String(c)];
    return prefix + (r > 0 ? " e " + numberToWords(r) : "");
  }
  if (n < 1_000_000) {
    const m = Math.floor(n / 1000);
    const r = n % 1000;
    const prefix = m === 1 ? "mil" : numberToWords(m) + " mil";
    return prefix + (r > 0 ? " e " + numberToWords(r) : "");
  }
  if (n < 1_000_000_000) {
    const m = Math.floor(n / 1_000_000);
    const r = n % 1_000_000;
    const prefix = m === 1 ? "um milhão" : numberToWords(m) + " milhões";
    return prefix + (r > 0 ? " e " + numberToWords(r) : "");
  }
  return String(n);
}

/**
 * Converte um valor numérico (ex.: 50, 1250.50) para string falada.
 * Ex.: 50 → "cinquenta", 1250.50 → "mil duzentos e cinquenta reais e cinquenta centavos"
 */
function currencyToWords(value: number): string {
  const reais = Math.floor(value);
  const centavos = Math.round((value - reais) * 100);

  if (reais === 0 && centavos === 0) return "zero reais";

  let result = "";
  if (reais > 0) {
    result += numberToWords(reais) + " reais";
  }
  if (centavos > 0) {
    result += (reais > 0 ? " e " : "") + numberToWords(centavos) + " centavo" + (centavos > 1 ? "s" : "");
  }
  return result;
}

/**
 * Normaliza um texto para ser falado pelo TTS.
 * Converte R$, %, datas, horários e abreviações para linguagem natural.
 */
export function normalizeForTTS(text: string): string {
  let result = text;

  // 1. Valores monetários "R$ 1.234,56", "R$ 1.500" ou "R$ 50" → fala natural.
  //    O prefixo "R$" é OBRIGATÓRIO para nunca converter números comuns
  //    (dias, quantidades, anos) em reais.
  //    Alternativas (ordem importa — a mais específica primeiro):
  //    a) \d{1,3}(\.\d{3})+ com centavos opcionais → milhar BR ("4.060,00")
  //    b) \d+\.\d{2} → malformado do LLM ("4.60") → trata como 460 reais
  //    c) \d+ com centavos opcionais por vírgula → número simples ("460,00")
  result = result.replace(
    /\bR\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+\.\d{2}|\d+(?:,\d{1,2})?)\b/g,
    (match, value) => {
      let cleaned = value.replace(/\./g, "").replace(",", ".");
      // Formato malformado "4.60" (ponto decimal do LLM): o valor real é o
      // inteiro sem o ponto — "4.60" significa 460 reais, não 4,60.
      if (/^\d+\.\d{2}$/.test(value)) {
        return currencyToWords(parseInt(value.replace(".", ""), 10));
      }
      const num = parseFloat(cleaned);
      if (isNaN(num)) return match;
      return currencyToWords(num);
    },
  );

  // 1b. Números inteiros com separador de milhar "4.184" → por extenso.
  //     Exige grupos EXATOS de 3 dígitos após o ponto (convenção BR),
  //     então não conflita com decimais nem com datas/horas.
  result = result.replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g, (match, value) => {
    const num = parseInt(value.replace(/\./g, ""), 10);
    if (isNaN(num)) return match;
    return numberToWords(num);
  });

  // 1c. Durações "1800s" → "mil e oitocentos segundos" (intervalos de campanha)
  result = result.replace(/\b(\d+)\s*s\b/gi, (match, value) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return match;
    return numberToWords(num) + " segundos";
  });

  // 2. Porcentagem "X%" ou "X,Y%" → "X por cento" (aceita decimais)
  result = result.replace(/\b(\d+(?:,\d{1,2})?)\s*%/g, (match, value) => {
    const [intStr, decStr] = String(value).split(",");
    const intPart = parseInt(intStr, 10);
    if (isNaN(intPart)) return match;
    let out = numberToWords(intPart);
    if (decStr) {
      const decNum = parseInt(decStr, 10);
      if (decNum > 0) out += " vírgula " + numberToWords(decNum);
    }
    return out + " por cento";
  });

  // 3. Datas DD/MM/YYYY ou DD/MM/YY → "DD de MÊS de ANO"
  result = result.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g, (match, day, month, year) => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m < 1 || m > 12) return match;
    const monthName = MONTHS[m - 1];
    const yearStr = y >= 2000 ? numberToWords(y) : numberToWords(2000 + y);
    return `${numberToWords(d)} de ${monthName} de ${yearStr}`;
  });

  // 4. Horários HH:MM → "HH horas e MM minutos"
  result = result.replace(/\b(\d{1,2}):(\d{2})\b/g, (match, hour, min) => {
    const h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    if (h > 23 || m > 59) return match;
    const hourStr = numberToWords(h) + (h === 1 ? " hora" : " horas");
    if (m === 0) return hourStr;
    return hourStr + " e " + numberToWords(m) + (m === 1 ? " minuto" : " minutos");
  });

  // 5. Abreviações comuns
  result = result.replace(/\b(\d+)\s*km\b/gi, (match, value) => {
    return numberToWords(parseInt(value, 10)) + " quilômetros";
  });

  // 4b. Números inteiros grandes SEM separador (>= 1000) → por extenso.
  //     Roda APÓS datas/horas/porcentagens para não interferir. Cobre
  //     contagens cruas do LLM (ex.: "4184 leads") que o TTS leria mal.
  result = result.replace(/\b(\d{4,9})\b/g, (match, value) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return match;
    return numberToWords(num);
  });
  result = result.replace(/\b(\d+)\s*h\b/gi, (match, value) => {
    return numberToWords(parseInt(value, 10)) + (parseInt(value, 10) === 1 ? " hora" : " horas");
  });
  result = result.replace(/\b(\d+)\s*min\b/gi, (match, value) => {
    return numberToWords(parseInt(value, 10)) + (parseInt(value, 10) === 1 ? " minuto" : " minutos");
  });
  result = result.replace(/\b(\d+)\s*kg\b/gi, (match, value) => {
    return numberToWords(parseInt(value, 10)) + " quilogramas";
  });
  result = result.replace(/\b(\d+)\s*°?C\b/gi, (match, value) => {
    return numberToWords(parseInt(value, 10)) + " graus Celsius";
  });

  // 6. Limpeza: espaços duplos
  result = result.replace(/\s+/g, " ").trim();

  return result;
}