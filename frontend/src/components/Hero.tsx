import Title from "@/assets/title.svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { suggestions } from "@/lib/suggestions";
import { ArrowRightIcon, CodeIcon, SparklesIcon } from "lucide-react";
import { Link } from "react-router-dom";

type HeroProps = {
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  prompt: string;
};

export function Hero({
  handleSubmit,
  prompt,
  setPrompt,
  isLoading,
}: HeroProps) {
  return (
    <section className="flex flex-col items-center justify-center sm:px-6 mt-12 text-center w-full max-w-2xl">
      <Link
        to="https://blog.getalby.com/democratizing-bitcoin-app-development/"
        target="_blank"
      >
        <Badge className="mb-8 bg-primary/20 text-primary border-primary/30 py-1 rounded-full">
          <SparklesIcon className="w-4 h-4" /> The Story Behind LNFly{" "}
          <ArrowRightIcon className="w-4 h-4" />
        </Badge>
      </Link>

      <img src={Title} alt="LNFly" className="h-20 mb-6" />

      <p className="text-xl text-gray-300">
        Prototype lightning apps with a single prompt
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex w-full gap-2 items-end pt-6" // Added pt-6 for padding
      >
        <div className="flex flex-col w-full border-2 rounded-2xl pr-2 pb-2 backdrop-blur-xs">
          <Textarea
            autoFocus
            placeholder="Enter prompt to generate an app..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 text-white placeholder:text-gray-400 border-0 !bg-transparent !ring-0 resize-none"
          />
          <div className="flex justify-end">
            <LoadingButton
              type="submit"
              loading={isLoading}
              className="bg-gradient-primary"
            >
              <CodeIcon className="w-4 h-4 mr-2" /> Generate
            </LoadingButton>
          </div>
        </div>
      </form>

      <section className="flex justify-center sm:px-6 mt-6">
        <div className="flex flex-wrap gap-4 justify-center">
          {suggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <Button
                size="sm"
                key={index}
                variant="outline"
                className="rounded-full py-0 text-xs backdrop-blur-xs"
                onClick={() => {
                  setPrompt(suggestion.prompt);
                }}
              >
                <span className="mr-2">{<Icon />}</span>
                {suggestion.title}
              </Button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
