const CPA_PROVINCE_CODES = new Set([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "J",
  "K",
  "L",
  "M",
  "N",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
]);

const FOUR_DIGIT_ALLOWED_BY_FIRST_DIGIT: Record<string, Set<string>> = {
  "1": new Set(["B", "C"]),
  "2": new Set(["S"]),
  "3": new Set(["E", "H", "N", "P", "S", "W"]),
  "4": new Set(["A", "G", "K", "T", "Y"]),
  "5": new Set(["D", "F", "J", "M", "X"]),
  "6": new Set(["B", "L"]),
  "7": new Set(["B"]),
  "8": new Set(["B", "Q", "R"]),
  "9": new Set(["U", "V", "Z"]),
};

export function normalizeArgentinaPostalCode(postalCode: string) {
  return String(postalCode || "").trim().replace(/\s+/g, "").toUpperCase();
}

export function validateArgentinaPostalCodeProvince(postalCode: string, provinceCode: string) {
  const normalizedPostalCode = normalizeArgentinaPostalCode(postalCode);
  const normalizedProvinceCode = String(provinceCode || "").trim().toUpperCase();

  if (!normalizedPostalCode || !normalizedProvinceCode) return null;
  if (!CPA_PROVINCE_CODES.has(normalizedProvinceCode)) return null;

  const cpaMatch = normalizedPostalCode.match(/^([A-Z])\d{4}[A-Z]{3}$/);
  if (cpaMatch) {
    const postalProvinceCode = cpaMatch[1];
    if (postalProvinceCode !== normalizedProvinceCode) {
      return "El Código Postal Argentino no corresponde con la provincia seleccionada.";
    }
    return null;
  }

  if (/^\d{4}$/.test(normalizedPostalCode)) {
    const firstDigit = normalizedPostalCode[0];
    const allowed = FOUR_DIGIT_ALLOWED_BY_FIRST_DIGIT[firstDigit];

    if (firstDigit === "1") {
      const numeric = Number(normalizedPostalCode);
      if (normalizedProvinceCode === "C") {
        return numeric >= 1000 && numeric <= 1499
          ? null
          : "Ese código postal no corresponde a CABA.";
      }
      if (normalizedProvinceCode === "B") {
        return numeric >= 1500 && numeric <= 1999
          ? null
          : "Ese código postal no corresponde a Provincia de Buenos Aires.";
      }
    }

    if (allowed && !allowed.has(normalizedProvinceCode)) {
      return "El código postal no corresponde con la provincia seleccionada.";
    }

    return null;
  }

  return "Ingresá un código postal de 4 dígitos o un CPA válido, por ejemplo C1003ABC.";
}
