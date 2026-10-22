import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import PivotTable from "@/components/PivotTable";
import { editionTitle, findEdition } from "@/lib/events";

export default function PivotPage({ params }) {
  const edition = findEdition(params.slug);
  if (!edition) notFound();

  return <>
    <TopBar title={`${editionTitle(edition)} · ตารางวิเคราะห์`} back />
    <PivotTable edition={edition} />
  </>;
}
