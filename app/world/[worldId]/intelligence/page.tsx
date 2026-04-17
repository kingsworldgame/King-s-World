import { IntelligenceClient } from "./intelligence-client";

export default function IntelligencePage({ params }: { params: { worldId: string } }) {
  return <IntelligenceClient params={params} />;
}
