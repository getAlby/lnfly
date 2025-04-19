type Suggestion = {
  title: string;
  prompt: string;
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
      "User has to pay 21 sats before they can see the video https://www.youtube.com/watch?v=dQw4w9WgXcQ&pp=ygUJcmljayByb2xs which will be displayed on the page. The video should auto-start.",
  },
  {
    title: "Tetris Paid Themes",
    prompt:
      "Make a simple tetris game but before you play you can choose from 3 themes. One is free (standard theme), one costs 21 sats (bitcoin theme), and one costs 42 sats (nostr theme). Controls should be just arrow keys (left/right arrows for movement, up arrow is rotate and down arrow is hard drop). If you lose, there should be a 'You Lose' screen with your score shown, and a button to play again, which you will be presented with the theme picker again.",
  },
  {
    title: "Amazing Button",
    prompt:
      "An app that has THE BUTTON. When you click it and pay the 21 sat fee, all sorts of amazing things happen, like fireworks and so forth.",
  },
];
