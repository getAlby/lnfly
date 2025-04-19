type Suggestion = {
  title: string;
  prompt: string;
};

export const suggestions: Suggestion[] = [
  {
    title: "Revivable Snake Game",
    prompt:
      "Make a classic snake game but when you die you can either choose to pay 21 sats to continue (re-spawning your snake and keeping your score and snake length), or restart for free",
  },
  {
    title: "Video Paywall",
    prompt:
      "User has to pay 21 sats before they can see the video https://www.youtube.com/watch?v=dQw4w9WgXcQ&pp=ygUJcmljayByb2xs which will be displayed on the page",
  },
];
