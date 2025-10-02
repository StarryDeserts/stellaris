"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Droplet, Loader2 } from "lucide-react"
import { useStellaris } from "@/contract"
import { notifyError, notifySuccess, notifyWarning } from "@/components/ToastProvider"

export default function FaucetCards() {
  const { sthAptFaucetMint, sUsdeFaucetMint, truAptFaucetMint } = useStellaris()
  const [loading, setLoading] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  const tokens = [
    {
      id: "sthApt",
      name: "STH APT",
      symbol: "sthAPT",
      icon: "https://assets.panora.exchange/tokens/aptos/STHAPT.png",
      faucet: sthAptFaucetMint,
    },
    {
      id: "sUSDe",
      name: "sUSDe",
      symbol: "sUSDe",
      icon: "https://assets.panora.exchange/tokens/aptos/sUSDe.png",
      faucet: sUsdeFaucetMint,
    },
    {
      id: "truApt",
      name: "Tru APT",
      symbol: "truAPT",
      icon: "https://assets.panora.exchange/tokens/aptos/TruAPT.png",
      faucet: truAptFaucetMint,
    },
  ]

  const handleClaim = async (tokenId: string, faucetFn: (amount: number) => Promise<any>, tokenSymbol: string) => {
    const amountStr = amounts[tokenId]
    if (!amountStr || isNaN(Number(amountStr))) {
      notifyWarning("Please enter a valid amount")
      return
    }

    const finalAmount = Number(amountStr) * 100000000
    setLoading(tokenId)

    try {
      const txHash = await faucetFn(finalAmount)
      notifySuccess(`🎉 successfully!`)
    } catch (err: any) {
      notifyError(`Failed to claim : ${err.message || "Unknown error"}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Testnet Faucet</h2>
          <p className="text-muted-foreground">Claim testnet tokens directly to your connected wallet</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {tokens.map((token) => (
            <Card key={token.id} className="relative overflow-hidden transition-all hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex items-center justify-between">
                  <img src={token.icon} alt={token.symbol} className="w-12 h-12 rounded-full" />
                  <div className="rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-xs font-semibold">
                    Testnet
                  </div>
                </div>
                <CardTitle className="text-2xl">{token.symbol}</CardTitle>
                {/* <CardDescription className="text-base">{token.symbol}</CardDescription> */}
              </CardHeader>

              <CardContent>
                <Label htmlFor={`amount-${token.id}`} className="mb-2 block text-sm font-medium">
                  Amount
                </Label>
                <Input
                  id={`amount-${token.id}`}
                  type="number"
                  placeholder="Enter amount"
                  value={amounts[token.id] || ""}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [token.id]: e.target.value }))}
                  className="h-10 text-base"
                />
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={loading !== null}
                  onClick={() => handleClaim(token.id, token.faucet, token.symbol)}
                >
                  {loading === token.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Droplet className="mr-2 h-4 w-4" />
                      Claim {token.symbol}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
