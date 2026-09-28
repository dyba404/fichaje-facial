// Bus de eventos en vivo (REQ-DASH-02): cada marcaje se publica a los
// suscriptores SSE del dashboard. En memoria — un solo proceso para el MVP.

import type { FeedItem } from "@recon/core";

type Subscriber = (item: FeedItem) => void;

const subscribers = new Set<Subscriber>();

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function publish(item: FeedItem): void {
  for (const s of subscribers) {
    try {
      s(item);
    } catch {
      // un suscriptor caído no rompe el resto
    }
  }
}
