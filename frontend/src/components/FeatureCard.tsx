import { ReactNode } from 'react';

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
};

export default function FeatureCard({ icon, title, description, className }: FeatureCardProps) {
  return (
    <div className={("bg-white p-6 flex flex-col items-center text-center gap-2 border " + (className || "")).trim()}>
      <div className="text-indigo-600 mb-2">{icon}</div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-gray-500 text-sm">{description}</p>
    </div>
  );
}
