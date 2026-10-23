import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import CustomerJourney from "@/components/CustomerJourney";
import { editionTitle, findEdition } from "@/lib/events";

export default function CustomerJourneyPage({ params }) {
  const edition = findEdition(params.slug);
  if (!edition) notFound();

  return <>
    <TopBar title={`${editionTitle(edition)} · Customer Journey`} back />
    <CustomerJourney edition={edition} />
  </>;
}
