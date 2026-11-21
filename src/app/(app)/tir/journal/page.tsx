import { PermitJournal, type JournalSP } from "../PermitJournal";

export default function TirJournalPage({ searchParams }: { searchParams: Promise<JournalSP> }) {
  return <PermitJournal type="TIR" searchParams={searchParams} />;
}
