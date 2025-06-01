export const knowledgeReact = {
  name: "React",
  environment: "frontend",
  usecase:
    "Use React to simplify the development of more complex frontend applications",
  prompt: `**HTML Code Structure:** Follow this structure for generating the necessary html code.
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React 19 Demo</title>
  </head>
  <body>
    <div id="root"></div>

    <script type="module">
      // Import React 19 instantly from ESM CDN
      import React from "https://esm.sh/react@19";
      import ReactDOM from "https://esm.sh/react-dom@19/client";

      // Your React app is just a few lines away
      const app = React.createElement(
        "h1",
        null,
        "React 19 in seconds, not minutes!"
      );
      const root = ReactDOM.createRoot(document.getElementById("root"));
      root.render(app);
    </script>
  </body>
</html>
`,
} as const;
