export const knowledgeNostrToolsSubscribe = {
  name: "nostr tools - subscribe",
  environment: "any",
  usecase: "subscribe to nostr notes from multiple relays",
  prompt: `
You know how to use nostr-tools to subscribe to notes on multiple relays:

<script type="module">
import { SimplePool, nip19 } from "https://esm.sh/nostr-tools";

const pool = new SimplePool()

const relays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://purplerelay.com']

pool.subscribe(
  relays,
  {
    // set the nostr filters you need... e.g.
    kinds: [1],
    authors: [pk], // nostr public key here e.g. from nip19.decode(npub) or window.nostr.getPublicKey()
  },
  {
    onevent(event: {
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
  pubkey: string;
  id: string;
  sig: string;
}) {
      console.log('got event:', event)
    }
  }
)

// once no longer needed you can close the connection
pool.close(relays);

</script>`,
} as const;
