import React from "react";
import { Link } from "react-router-dom";

const LNFlyHeading: React.FC = () => {
  return (
    <Link to="/" className="flex flex-col items-center">
      <h1 className="text-4xl font-bold mt-16 mb-2">LNFly</h1>{" "}
      <p className="mb-8 italic text-muted-foreground">
        Build lightning apps with a single prompt
      </p>
    </Link>
  );
};

export default LNFlyHeading;
