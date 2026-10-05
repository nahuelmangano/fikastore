import type { TransferBankDetails } from "@/lib/storeSettings";

const DEFAULT_TRANSFER_BANK_DETAILS: TransferBankDetails = {
  accountNumber: "5025-566703/8",
  cbu: "0140033503502556670388",
  alias: "FIKAPIJAMAS",
  holder: "CINTIA YANINA,NIZ",
  taxId: "27-37175129-2",
  accountType: "Caja de Ahorro",
  bank: "Banco de la Provincia de Buenos Aires",
};

function hasBankDetails(value: string) {
  return /\b(cbu|alias|cuenta|cuil|cuit|banco)\b/i.test(value);
}

function removeBankDetailLines(value: string) {
  return value
    .split("\n")
    .filter((line) => !/^\s*(ca\s*\$|cbu\b|alias\s+cbu|titular|integrante|cuil\s*\/?\s*cuit|tipo\b|banco\b)/i.test(line.trim()))
    .join("\n")
    .trim();
}

export function transferInstructionsWithBankDetails(instructions: string, bankDetails?: TransferBankDetails) {
  const clean = instructions.trim();
  if (!bankDetails && hasBankDetails(clean)) return clean;
  const details = bankDetails || DEFAULT_TRANSFER_BANK_DETAILS;
  const bankText = [
    details.accountNumber ? `CA $: ${details.accountNumber}` : "",
    details.cbu ? `CBU: ${details.cbu}` : "",
    details.alias ? `Alias: ${details.alias}` : "",
    details.holder ? `Titular: ${details.holder}` : "",
    details.taxId ? `CUIL/CUIT: ${details.taxId}` : "",
    details.accountType ? `Tipo: ${details.accountType}` : "",
    details.bank ? `Banco: ${details.bank}` : "",
  ].filter(Boolean).join("\n");
  return [bankText, bankDetails ? removeBankDetailLines(clean) : clean].filter(Boolean).join("\n\n");
}
