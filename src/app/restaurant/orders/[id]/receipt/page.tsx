import SingleSlipPage from "@/modules/restaurant/SingleSlipPage";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SingleSlipPage params={params} kind="customer" />;
}
