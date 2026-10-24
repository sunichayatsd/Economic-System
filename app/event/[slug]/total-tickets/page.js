import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import TotalTickets from "@/components/TotalTickets";
import { editionTitle, findEdition } from "@/lib/events";

export default function TotalTicketsPage({ params }) {
  const edition = findEdition(params.slug);
  if (!edition) notFound();

  return <>
    <TopBar title={`${editionTitle(edition)} · Total Tickets`} back />
    <TotalTickets edition={edition} />
  </>;
}
