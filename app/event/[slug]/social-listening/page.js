import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import EventFeaturePage from "@/components/EventFeaturePage";
import { editionTitle, findEdition } from "@/lib/events";

export default function SocialListeningPage({ params }) {
  const edition = findEdition(params.slug);
  if (!edition) notFound();

  return <>
    <TopBar title={`${editionTitle(edition)} · Social Listening`} back />
    <EventFeaturePage edition={edition} feature="social-listening" />
  </>;
}
