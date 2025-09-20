"use client";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { WalletProvider } from "@/components/providers/WalletProvider";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { RootHeader } from "@/components/RootHeader";

export function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <WalletProvider>
          <div className="flex justify-center w-full">
            <main className="flex flex-col w-full max-w-[1000px] p-6 pb-12 md:px-8">
              <RootHeader />
              {children}
              <Toaster />
            </main>
          </div>
        </WalletProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}