"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Users } from "lucide-react";
import { MarketListItem } from "@/lib/type/market";
import { ObjectOnExplorer } from "@/components/ExplorerLink";

// Mock data for demonstration - replace with actual data fetching
const mockMarkets: MarketListItem[] = [
  {
    id: "0x123...",
    description: "Will Bitcoin reach $100,000 by end of 2024?",
    treasury: "0x456...",
    winning_side: null,
    create_time: 1703980800000, // Dec 30, 2023
    close_time: 1735516800000, // Dec 30, 2024
    a_pool: { id: "0x789..." },
    b_pool: { id: "0xabc..." },
    total_a_effective_stake: 50000000000, // 500 tokens
    total_b_effective_stake: 30000000000, // 300 tokens
    status: true,
    timeRemaining: 86400000, // 1 day in ms
    totalStake: "80000000000",
    odds: { a: 1.6, b: 2.67 }
  },
  {
    id: "0x456...",
    description: "Will Ethereum 2.0 staking rewards exceed 5% APY?",
    treasury: "0x789...",
    winning_side: true,
    create_time: 1703894400000,
    close_time: 1703980800000,
    a_pool: { id: "0xdef..." },
    b_pool: { id: "0xghi..." },
    total_a_effective_stake: 75000000000,
    total_b_effective_stake: 25000000000,
    status: false,
    timeRemaining: 0,
    totalStake: "100000000000",
    odds: { a: 1.33, b: 4.0 }
  }
];

interface MarketListProps {
  onSelectMarket?: (marketId: string) => void;
  onCreateMarket?: () => void;
}

export function MarketList({ onSelectMarket, onCreateMarket }: MarketListProps) {
  const [markets] = useState<MarketListItem[]>(mockMarkets);

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Closed";
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const formatStake = (stake: string | number) => {
    const num = (typeof stake === 'string' ? parseInt(stake) : stake) / 1000000000; // Assuming 9 decimals
    return num.toFixed(2);
  };

  const getStatusBadge = (market: MarketListItem) => {
    if (!market.status) {
      return (
        <Badge variant="secondary">
          Settled - {market.winning_side ? "A" : "B"} Won
        </Badge>
      );
    }
    if (market.timeRemaining && market.timeRemaining <= 0) {
      return <Badge variant="destructive">Closed</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Prediction Markets
        </CardTitle>
        <Button onClick={onCreateMarket} variant="outline">
          Create Market
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {markets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No markets available
          </div>
        ) : (
          markets.map((market) => (
            <Card key={market.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm mb-2 line-clamp-2">
                      {market.description}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {market.timeRemaining ? formatTimeRemaining(market.timeRemaining) : "Closed"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Total: {formatStake(market.totalStake || "0")} tokens
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(market)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Side A (Yes)</div>
                    <div className="font-medium text-sm">
                      {formatStake(market.total_a_effective_stake)} tokens
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400">
                      Odds: {market.odds?.a.toFixed(2)}x
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Side B (No)</div>
                    <div className="font-medium text-sm">
                      {formatStake(market.total_b_effective_stake)} tokens
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400">
                      Odds: {market.odds?.b.toFixed(2)}x
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    Market ID: <ObjectOnExplorer address={market.id} />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectMarket?.(market.id)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}