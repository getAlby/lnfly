import FooterSvg from "@/assets/footer.svg";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="sm:px-20 w-full mt-32">
      <div className="px-8">
        <img src={FooterSvg} />
      </div>
      <div className="border-t border-gray-900 flex flex-col w-full" />

      <p className="text-gray-400 text-sm mt-4">
        Built with ⚡ by{" "}
        <Link
          to="https://getalby.com"
          target="_blank"
          className="font-semibold"
        >
          Alby
        </Link>
      </p>
    </footer>
  );
}
