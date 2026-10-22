import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import Dashboard from "@/components/Dashboard";
import { findEdition, editionTitle } from "@/lib/events";

export default async function EventPage({ params }) {
  const edition = findEdition(params.slug);
  if (!edition) notFound();
  return (
    <>
      <TopBar title={editionTitle(edition)} back />
      <Dashboard edition={edition} />
    </>
  );
}
