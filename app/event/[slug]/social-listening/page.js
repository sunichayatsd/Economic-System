import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import SocialListening from "@/components/SocialListening";
import { editionTitle, findEdition } from "@/lib/events";

export default function SocialListeningPage({ params }) {
  const edition = findEdition(params.slug);
  if (!edition) notFound();

  return <>
    <TopBar title={`${editionTitle(edition)} · Social Listening`} back />
    <SocialListening edition={edition} />
  </>;
}
