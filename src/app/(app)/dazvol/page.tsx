import { PermitsList, type SP } from "../tir/PermitsList";

/** Dazvollar (qog'oz va elektron). Huquq — "TIR / Dazvol" bo'limi bilan bir xil. */
export default function DazvolPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <PermitsList type="DAZVOL" searchParams={searchParams} />;
}
