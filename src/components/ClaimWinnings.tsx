"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Trophy, Gift, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { MarketView, PositionView } from "@/lib/type/market";
import { LabelValueGrid } from "@/components/LabelValueGrid";
import { ObjectOnExplorer } from "@/components/ExplorerLink";

interface ClaimWinningsProps {
  market: MarketView;
  userPosition: PositionView;
  onWinningsClaimed?: (marketId: string, amount: string) => void;
  onCancel?: () => void;
}

export function ClaimWinnings({ 
  market, 
  userPosition, 
  onWinningsClaimed, 
  onCancel 
}: ClaimWinningsProps) {
  const { toast } = useToast();
  const { connected, account } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatStake = (stake: string | number) => {
    const num = (typeof stake === 'string' ? parseInt(stake) : stake) / 1000000000; // Assuming 9 decimals
    return num.toFixed(2);
  };

  const calculateWinnings = () => {
    if (market.winning_side === null) return 0;
    
    const totalA = market.total_a_effective_stake;
    const totalB = market.total_b_effective_stake;
    const total = totalA + totalB;
    
    if (total === 0) return 0;
    
    // Check if user won
    const userWon = userPosition.direction === market.winning_side;
    if (!userWon) return 0;
    
    // Calculate odds at the time of settlement
    const winningPool = market.winning_side ? totalA : totalB;
    const odds = total / winningPool;
    
    const effectiveStake = parseInt(userPosition.effective_stake);
    return (effectiveStake * odds) / 1000000000; // Convert back to display format
  };

  const calculateProfit = () => {
    const winnings = calculateWinnings();
    const stakeAmount = parseFloat(formatStake(userPosition.stake_amount));
    return winnings - stakeAmount;
  };

  const canClaim = () => {
    return (
      market.winning_side !== null && 
      !market.status && 
      userPosition.direction === market.winning_side
    );
  };

  const handleClaim = async () => {
    if (!account) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!canClaim()) {
      toast({
        title: "Error",
        description: "You cannot claim winnings for this market",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 调用真实的合约方法
      console.log("Claiming winnings for market:", market.id);
      
      // 这里应该调用 usePredictionMarket hook 中的 claimWinnings 方法
      // 但由于这个组件没有直接访问 hook，我们通过 onWinningsClaimed 回调来处理
      if (onWinningsClaimed) {
        const winnings = calculateWinnings();
        onWinningsClaimed(market.id, winnings.toString());
      } else {
        // 如果没有回调，显示提示信息
        toast({
          title: "Info",
          description: "Please use the claim button in the main interface to claim winnings",
        });
      }
      
    } catch (error) {
      console.error("Error claiming winnings:", error);
      toast({
        title: "Error",
        description: "Failed to claim winnings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const winnings = calculateWinnings();
  const profit = calculateProfit();
  const userWon = userPosition.direction === market.winning_side;

  return (
    <Card className={userWon ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${userWon ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {userWon ? <Trophy className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
          {userWon ? "Claim Your Winnings" : "Position Result"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market Info */}
        <div>
          <h4 className="font-medium mb-2">Market Question</h4>
          <p className="text-sm text-muted-foreground mb-3">{market.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm">Result:</span>
            <Badge variant={market.winning_side ? "default" : "destructive"}>
              {market.winning_side ? "A (Yes)" : "B (No)"} Won
            </Badge>
          </div>
        </div>

        {/* Position Summary */}
        <div className="p-4 bg-background/50 rounded-lg border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Your Position
          </h4>
          <LabelValueGrid
            items={[
              {
                label: "Your Bet",
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
                label: "Result",
                value: (
                  <Badge variant={userWon ? "default" : "destructive"}>
                    {userWon ? "Won" : "Lost"}
                  </Badge>
                ),
              },
            ]}
          />
        </div>

        {/* Winnings Calculation */}
        {userWon ? (
          <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
            <h4 className="font-medium mb-3 text-green-700 dark:text-green-300">
              Winnings Breakdown
            </h4>
            <LabelValueGrid
              items={[
                {
                  label: "Total Winnings",
                  value: (
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {winnings.toFixed(2)} tokens
                    </span>
                  ),
                },
                {
                  label: "Original Stake",
                  value: `${formatStake(userPosition.stake_amount)} tokens`,
                },
                {
                  label: "Profit",
                  value: (
                    <span className="font-medium text-green-600 dark:text-green-400">
                      +{profit.toFixed(2)} tokens
                    </span>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
            <h4 className="font-medium mb-2 text-red-700 dark:text-red-300">
              Position Lost
            </h4>
            <p className="text-sm text-red-600 dark:text-red-400">
              Your stake of {formatStake(userPosition.stake_amount)} tokens has been lost.
            </p>
          </div>
        )}

        {/* Market Details */}
        <div className="text-xs text-muted-foreground">
          <p>Market ID: <ObjectOnExplorer address={market.id} /></p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {userWon && canClaim() && (
            <Button
              onClick={handleClaim}
              disabled={!connected || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Claiming..." : `Claim ${winnings.toFixed(2)} tokens`}
            </Button>
          )}
          
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {userWon && canClaim() ? "Cancel" : "Close"}
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {!connected && (
          <p className="text-sm text-muted-foreground text-center">
            Please connect your wallet to claim winnings
          </p>
        )}

        {userWon && !canClaim() && market.status && (
          <p className="text-sm text-muted-foreground text-center">
            Market is not yet settled. Winnings will be available after settlement.
          </p>
        )}

        {!userWon && (
          <p className="text-sm text-center text-muted-foreground">
            Better luck next time! Try another market to test your prediction skills.
          </p>
        )}
      </CardContent>
    </Card>
  );
}