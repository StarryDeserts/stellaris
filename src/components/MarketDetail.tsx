"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  TrendingUp, 
  Users, 
  Trophy, 
  AlertCircle,
  ExternalLink 
} from "lucide-react";
import { MarketView, PositionView } from "@/lib/type/market";
import { ObjectOnExplorer } from "@/components/ExplorerLink";
import { LabelValueGrid } from "@/components/LabelValueGrid";

// Mock data for demonstration
const mockMarket: MarketView = {
  id: "0x123456789abcdef",
  description: "Will Bitcoin reach $100,000 by end of 2024?",
  treasury: "0x987654321fedcba",
  winning_side: null,
  create_time: 1703980800000,
  close_time: 1735516800000,
  a_pool: { id: "0x111111111111111" },
  b_pool: { id: "0x222222222222222" },
  total_a_effective_stake: 50000000000,
  total_b_effective_stake: 30000000000,
  status: true,
};

const mockUserPosition: PositionView = {
  id: "0xposition1",
  market_id: "0x123456789abcdef",
  player: "0xplayer1",
  direction: true,
  side: true,
  stake_amount: "5000000000",
  effective_stake: "5000000000",
  create_time: "1704153600000",
  claimed: false,
};

interface MarketDetailProps {
  marketId: string;
  onEnterPosition?: (marketId: string, direction: boolean) => void;
  onClaimWinnings?: (marketId: string) => void;
  onSettleMarket?: (marketId: string, winningSide: boolean) => void;
}

export function MarketDetail({ 
  marketId, 
  onEnterPosition, 
  onClaimWinnings,
  onSettleMarket 
}: MarketDetailProps) {
  const { account, connected } = useWallet();
  const [market, setMarket] = useState<MarketView | null>(null);
  const [userPosition, setUserPosition] = useState<PositionView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch actual market data and user position
    // This would call get_market_info and get_player_position_info
    const fetchData = async () => {
      setLoading(true);
      try {
        // Simulate API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
        setMarket(mockMarket);
        
        if (connected && account) {
          setUserPosition(mockUserPosition);
        }
      } catch (error) {
        console.error("Error fetching market data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [marketId, connected, account]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading market details...</div>
        </CardContent>
      </Card>
    );
  }

  if (!market) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Market not found
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatStake = (stake: string | number) => {
    const num = (typeof stake === 'string' ? parseInt(stake) : stake) / 1000000000; // Assuming 9 decimals
    return num.toFixed(2);
  };

  const formatTime = (timestamp: string | number) => {
    return new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp).toLocaleString();
  };

  const getTimeRemaining = () => {
    const now = Date.now();
    const closeTime = typeof market.close_time === 'string' ? parseInt(market.close_time) : market.close_time;
    const remaining = closeTime - now;
    
    if (remaining <= 0) return "Closed";
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const getTotalStake = () => {
    const totalA = typeof market.total_a_effective_stake === 'string' ? parseInt(market.total_a_effective_stake) : market.total_a_effective_stake;
    const totalB = typeof market.total_b_effective_stake === 'string' ? parseInt(market.total_b_effective_stake) : market.total_b_effective_stake;
    return totalA + totalB;
  };

  const getOdds = (side: 'a' | 'b') => {
    const totalA = typeof market.total_a_effective_stake === 'string' ? parseInt(market.total_a_effective_stake) : market.total_a_effective_stake;
    const totalB = typeof market.total_b_effective_stake === 'string' ? parseInt(market.total_b_effective_stake) : market.total_b_effective_stake;
    const total = totalA + totalB;
    
    if (total === 0) return 1.0;
    
    if (side === 'a') {
      return total / totalA;
    } else {
      return total / totalB;
    }
  };

  const getStakePercentage = (stake: string | number, total: number) => {
    if (total === 0) return 0;
    const stakeNum = typeof stake === 'string' ? parseInt(stake) : stake;
    return (stakeNum / total) * 100;
  };

  const totalStake = getTotalStake();
  const aPercentage = getStakePercentage(market.total_a_effective_stake, totalStake);
  const bPercentage = getStakePercentage(market.total_b_effective_stake, totalStake);

  const getStatusBadge = () => {
    if (!market.status) {
      return (
        <Badge variant="secondary">
          Settled - {market.winning_side ? "A" : "B"} Won
        </Badge>
      );
    }
    const closeTime = typeof market.close_time === 'string' ? parseInt(market.close_time) : market.close_time;
    if (closeTime <= Date.now()) {
      return <Badge variant="destructive">Closed</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const closeTime = typeof market.close_time === 'string' ? parseInt(market.close_time) : market.close_time;
  const canEnterPosition = market.status && closeTime > Date.now();
  const canClaim = !market.status && market.winning_side !== null && userPosition;
  const canSettle = market.status && closeTime <= Date.now();

  return (
    <div className="space-y-6">
      {/* Market Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{market.description}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {getTimeRemaining()}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Total: {formatStake(totalStake.toString())} tokens
                </div>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
      </Card>

      {/* Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-green-700 dark:text-green-300">
                Side A (Yes)
              </h3>
              <span className="text-sm font-medium">
                {getOdds('a').toFixed(2)}x
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {formatStake(market.total_a_effective_stake)} tokens
              </div>
              <Progress value={aPercentage} className="h-2" />
              <div className="text-sm text-muted-foreground">
                {aPercentage.toFixed(1)}% of total stake
              </div>
            </div>
            {canEnterPosition && (
              <Button
                className="w-full mt-3"
                size="sm"
                onClick={() => onEnterPosition?.(market.id, true)}
                disabled={!connected}
              >
                Bet Yes
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-red-700 dark:text-red-300">
                Side B (No)
              </h3>
              <span className="text-sm font-medium">
                {getOdds('b').toFixed(2)}x
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {formatStake(market.total_b_effective_stake)} tokens
              </div>
              <Progress value={bPercentage} className="h-2" />
              <div className="text-sm text-muted-foreground">
                {bPercentage.toFixed(1)}% of total stake
              </div>
            </div>
            {canEnterPosition && (
              <Button
                className="w-full mt-3"
                size="sm"
                variant="destructive"
                onClick={() => onEnterPosition?.(market.id, false)}
                disabled={!connected}
              >
                Bet No
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Position */}
      {userPosition && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Your Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LabelValueGrid
              items={[
                {
                  label: "Side",
                  value: (
                    <Badge variant={userPosition.direction ? "default" : "destructive"}>
                      {userPosition.direction ? "A (Yes)" : "B (No)"}
                    </Badge>
                  ),
                },
                {
                  label: "Stake Amount",
                  value: `${formatStake(userPosition.stake_amount)} tokens`,
                },
                {
                  label: "Effective Stake",
                  value: `${formatStake(userPosition.effective_stake)} tokens`,
                },
                {
                  label: "Potential Payout",
                  value: `${(parseFloat(formatStake(userPosition.effective_stake)) * getOdds(userPosition.direction ? 'a' : 'b')).toFixed(2)} tokens`,
                },
              ]}
            />
            {canClaim && (
              <Button
                className="w-full mt-4"
                onClick={() => onClaimWinnings?.(market.id)}
              >
                Claim Winnings
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Market Details */}
      <Card>
        <CardHeader>
          <CardTitle>Market Details</CardTitle>
        </CardHeader>
        <CardContent>
          <LabelValueGrid
            items={[
              {
                label: "Market ID",
                value: <ObjectOnExplorer address={market.id} />,
              },
              {
                label: "Treasury",
                value: <ObjectOnExplorer address={market.treasury || ""} />,
              },
              {
                label: "Created",
                value: formatTime(market.create_time),
              },
              {
                label: "Closes",
                value: formatTime(market.close_time),
              },
              {
                label: "A Pool",
                value: <ObjectOnExplorer address={market.a_pool?.id || ""} />,
              },
              {
                label: "B Pool",
                value: <ObjectOnExplorer address={market.b_pool?.id || ""} />,
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* Admin Actions */}
      {canSettle && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
              Admin Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This market has closed and needs to be settled.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onSettleMarket?.(market.id, true)}
              >
                Settle A Wins
              </Button>
              <Button
                variant="outline"
                onClick={() => onSettleMarket?.(market.id, false)}
              >
                Settle B Wins
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}