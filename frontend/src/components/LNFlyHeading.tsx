import { InfoIcon } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

const LNFlyHeading: React.FC = () => {
  return (
    <div>
      <Link to="/" className="flex flex-col items-center">
        <h1 className="text-4xl font-bold mt-16 mb-2">LNFly</h1>{" "}
      </Link>
      <p className="mb-8 italic text-muted-foreground">
        Prototype lightning apps with a single prompt
        <a
          href="https://github.com/getAlby/lnfly?tab=readme-ov-file#lnfly"
          target="_blank"
        >
          <InfoIcon className="w-4 h-4 inline ml-1" />
        </a>
      </p>
    </div>
  );
};

export default LNFlyHeading;
