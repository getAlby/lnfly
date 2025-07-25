import { ZapIcon } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between px-6 py-6 border-b border-gray-900 w-full">
      <Link to="/">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-lg">
              <ZapIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold">LNFly</div>
        </div>
      </Link>
      <nav className="flex items-center gap-4">
        <Link
          to="https://github.com/getalby/lnfly"
          target="_blank"
          className="text-gray-300 hover:text-white transition-colors"
        >
          Docs
        </Link>
      </nav>
    </header>
  );
};

export default Header;
