import { PermitsList, type SP } from "./PermitsList";

/** TIR karnetlar (dazvollar — /dazvol, alohida menyu bandi). */
export default function TirPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <PermitsList type="TIR" searchParams={searchParams} />;
}
