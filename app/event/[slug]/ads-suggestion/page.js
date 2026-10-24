import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import EventFeaturePage from "@/components/EventFeaturePage";
import { editionTitle, findEdition } from "@/lib/events";

export default function AdsSuggestionPage({ params }) {
  const edition = findEdition(params.slug);
  if (!edition) notFound();

  return <>
    <TopBar title={`${editionTitle(edition)} · Ads Suggestion`} back />
    <EventFeaturePage edition={edition} feature="ads-suggestion" />
  </>;
}
