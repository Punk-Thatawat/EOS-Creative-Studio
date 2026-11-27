import ConnectEos from "./connect-eos";

export const metadata = { title: "Connect EOS Local", referrer: "no-referrer" as const };

export default async function McpConnectPage({ searchParams }: {
  searchParams: Promise<{ ticket?: string | string[] }>;
}) {
  const { ticket } = await searchParams;
  return <ConnectEos ticket={typeof ticket === "string" && ticket.length <= 512 ? ticket : ""} />;
}
