"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletSelector } from "@/components/wallet/WalletSelector";

export const RootHeader = () => {
  return (
    <div className="flex justify-between items-center gap-6 pb-5">
      <div className="flex flex-col gap-2 md:gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          <a href="/">Stellaris</a>
        </h1>
      </div>
      <div className="flex space-x-2 items-center justify-center">
        <div className="flex-grow text-right min-w-0">
          <WalletSelector />
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
};