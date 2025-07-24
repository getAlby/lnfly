import { Rocket, Wallet, Zap } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast Development",
    description:
      "Generate Lightning Network apps in seconds with AI-powered prototyping",
  },
  {
    icon: Rocket,
    title: "1-Click Deployment",
    description:
      "Deploy your app directly on LNFly. Copy the code to continue building your app",
  },
  {
    icon: Wallet,
    title: "Build and Earn",
    description:
      "Receive payments directly to your lightning wallet from users who spend in your app",
  },
];

export function Features() {
  return (
    <section className="px-6 mt-24 bg-gray-950/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((feature, index) => (
            <div key={index} className="text-center">
              <div className="flex justify-center">
                <div className="p-4 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h3 className="text font-semibold mb-4">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
