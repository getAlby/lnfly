type Suggestion = {
  title: string;
  prompt: string;
  hasBackend?: boolean;
};

export const suggestions: Suggestion[] = [
  {
    title: "Revivable Snake Game",
    prompt:
      "Make a classic snake game but the only way to die is by the snake hitting itself. When you lose you can either choose to pay 21 sats to continue (re-spawning your snake and keeping your score and snake length but move the snake re-spawn position so the snake doesn't die), or restart for free.",
  },
  {
    title: "Video Paywall",
    prompt:
      "User has to pay 21 sats before they can see the video https://www.youtube.com/watch?v=dQw4w9WgXcQ&pp=ygUJcmljayByb2xs which will be displayed on the page. Once paid, the video should auto-start.",
  },
  {
    title: "Nostr Bot",
    prompt:
      'Create a button that when pressed, it should do a request to the backend of the app to post a note to nostr. The content of the note should be "Hello World".',
  },
  {
    title: "AI Chat",
    prompt:
      "Make a simple AI chat app, where I can type a message to prompt the AI.",
  },
  // {
  //   title: "Tetris Themes",
  //   prompt:
  //     "Make a simple tetris game but before you play you can choose from 3 themes. One is free (standard theme), one costs 21 sats (bitcoin theme), and one costs 42 sats (nostr theme). Controls should be just arrow keys (left/right arrows for movement, up arrow is rotate and down arrow is hard drop). If you lose, there should be a 'You Lose' screen with your score shown, and a button to play again, which you will be presented with the theme picker again.",
  // },
  // {
  //   title: "Amazing Button",
  //   prompt:
  //     "An app that has THE BUTTON. When you click it and pay the 21 sat fee, all sorts of amazing things happen, like fireworks and so forth.",
  // },
  {
    title: "Coinflip",
    hasBackend: true,
    prompt: `make a simple app with title "Flip a coin" and two buttons (heads or tails). When the user presses one of the buttons:

1. the user should be prompted to connect to their wallet using bitcoin connect
2. Request a 42 sat invoice from the user's wallet. This will be paid by the backend if the user guesses correctly.
3. Do a request to the backend, passing the user's choice and their invoice. The backend will use NWC to generate a 21 sat invoice and return it as the response.
4. The user must pay the invoice using their connected wallet.
5. Once the invoice is paid, begin polling a different endpoint on the backend once every 3 seconds. The invoice must be passed in the request. This endpoint will check if the invoice was paid, and if it was paid, flip the coin and return the result. If the user guessed correctly, the backend should also pay the user's invoice they provided.
6. In the frontend, if a result is returned from the polling endpoint, check if it matches the user's choice. If so, show some confetti and "You guessed correctly! Enjoy the 42 sats!", otherwise show "you guessed incorrectly".`,
  },
  {
    title: "Top Paid Link",
    hasBackend: true,
    prompt: `Make a page with a big button which will open a link in a new tab. The default link is "https://example.com" if no-one has paid for a link yet. Otherwise, it will use the latest paid link. The latest paid link should be hidden. The only way for the user to know the link is by clicking on the button.

Add a small "change link" button below. If the user clicks it, they should be prompted to type a link. Once they have entered a link, they should be shown a bitcoin connect payment modal to make a payment of 21 sats times the number of links already set (including the default link).

Add a small "view previous links" button below. This will show the links and the price paid. For the latest link, show ??? rather than the actual URL.

To generate the invoice that needs to be paid by the user, use NWC.

The backend should store a list of submitted links.`,
  },
  {
    title: "Lightning Faucet",
    hasBackend: true,
    prompt: `Make a "Lightning Faucet" app which allows the user to connect their wallet, generate an invoice of exactly 21 sats and the faucet backend will pay it using NWC.

Faucet Backend:
- Only allow one payout per hour.
- Parse the invoice to ensure it is exactly 21 sats.

Faucet frontend:
- Only allow the user to connect their wallet if it was an hour since the last payout, otherwise show a countdown timer and progress bar that shows when the faucet can next be used.
- If the user can connect their wallet, show a single button "Connect Wallet". Once connected, request a 21 sat invoice and send it to the faucet.
- Show the last payout time.
- If the payment succeeds, show a confetti animation and a success message.
- Style the app with a bitcoin theme and center the content and make it look good.`,
  },
];
