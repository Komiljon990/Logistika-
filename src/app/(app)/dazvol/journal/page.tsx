import { PermitJournal, type JournalSP } from "../../tir/PermitJournal";

export default function DazvolJournalPage({ searchParams }: { searchParams: Promise<JournalSP> }) {
  return <PermitJournal type="DAZVOL" searchParams={searchParams} />;
}
