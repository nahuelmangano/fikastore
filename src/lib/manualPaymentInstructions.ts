const DEFAULT_TRANSFER_BANK_DETAILS = [
  "CA $ 5025-566703/8",
  "CBU: 0140033503502556670388",
  "Alias CBU: FIKAPIJAMAS",
  "Integrante: CINTIA YANINA,NIZ",
  "CUIL/CUIT: 27-37175129-2",
  "Tipo: Caja de Ahorro",
  "Banco de la Provincia de Buenos Aires",
].join("\n");

function hasBankDetails(value: string) {
  return /\b(cbu|alias|cuenta|cuil|cuit|banco)\b/i.test(value);
}

export function transferInstructionsWithBankDetails(instructions: string) {
  const clean = instructions.trim();
  if (hasBankDetails(clean)) return clean;
  return [DEFAULT_TRANSFER_BANK_DETAILS, clean].filter(Boolean).join("\n\n");
}
