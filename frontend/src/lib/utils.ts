import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAppViewUrl(appId: number, subdomain?: string) {
  if (import.meta.env.MODE === "production") {
    return `${window.location.protocol}//${subdomain || appId}.${
      window.location.host
    }`;
  }

  return `/api/apps/${appId}/view`;
}
