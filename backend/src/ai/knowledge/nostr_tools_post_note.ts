export const knowledgeNostrToolsPostNote = {
  name: "nostr tools - post note",
  environment: "any",
  usecase: "post a nostr note to multiple relays",
  prompt: `
You know how to use nostr-tools to post a note to multiple relays:

<script type="module">
import { generateSecretKey, finalizeEvent, getPublicKey, SimplePool, nip19 } from "https://esm.sh/nostr-tools";

const pool = new SimplePool()

const relays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://purplerelay.com']

// optional: for the deno backend the developer can provide an NSEC using \`Deno.env.get("NSEC")\`
const sk = generateSecretKey(nip19.decode(YOUR_NSEC))
const pk = getPublicKey(sk)

// or ONLY IF EXPLICITLY SPECIFIED by the user's prompt that a random key should be used:
// const sk = generateSecretKey();

let eventTemplate = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'change the message here',
}

// this assigns the pubkey, calculates the event id and signs the event in a single step
const signedEvent = finalizeEvent(eventTemplate, sk)

// or for frontend you could use:
// const pk = window.nostr.getPublicKey();
// const signedEvent = await window.nostr.signEvent(eventTemplate);

await Promise.any(pool.publish(relays, signedEvent))

// once no longer needed you can close the connection
pool.close(relays);

</script>`,
} as const;
