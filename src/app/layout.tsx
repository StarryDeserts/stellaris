"use client"
import { Navigation } from "@/components/NavBar"
import "./globals.css"
import { AppProviders } from "@/components/AppProviders"
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import ToastProvider from "@/components/ToastProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Stellaris</title>
        <link rel="icon" href="/logo/logo.svg" type="image/svg+xml" />
        <meta name="description" content="Stellaris - DeFi Protocol on Aptos" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
      <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{
        network: Network.TESTNET,
        aptosApiKeys: {
          mainnet: process.env.APTOS_API_KEY_MAINNET,
        }
      }}
      onError={(error) => {
        console.log("error", error);
      }}
    >
        <AppProviders>
        <Navigation />{children} <ToastProvider /> </AppProviders>
        </AptosWalletAdapterProvider>
      </body>
    </html>
  )
}
