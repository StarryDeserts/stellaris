"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, RefreshCw } from "lucide-react";
import { Market, Position } from "@/lib/type/market";
import { usePredictionMarket } from "@/contract";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

interface UserPositionProps {
  market: Market;
  poolABalance: number;
  poolBBalance: number;
  onClaimWinnings?: () => void;
}

export function UserPosition({ 
  market, 
  poolABalance, 
  poolBBalance, 
  onClaimWinnings 
}: UserPositionProps) {
  const { toast } = useToast();
  const { account, connected } = useWallet();
  const { getPositionInfo } = usePredictionMarket();
  
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPosition, setHasPosition] = useState(false);

  // 获取用户持仓信息
  const fetchUserPosition = async () => {
    if (!connected || !account || !market) return;
    
    setLoading(true);
    try {
      console.log("Fetching position for user:", account.address.toString());
      const positionData = await getPositionInfo(account.address.toString(), market.id);
      console.log("Position data received:", positionData);
      
      setPosition(positionData);
      setHasPosition(true);
    } catch (error) {
      console.log("No position found for user:", error);
      setPosition(null);
      setHasPosition(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPosition();
  }, [connected, account, market]);

  // 格式化数字
  const formatStake = (stake: number | string) => {
    const num = typeof stake === 'string' ? parseInt(stake) : stake;
    return (num / 1000000000).toFixed(2);
  };

  // 计算权益有效性百分比
  const calculateOwnershipPercentage = () => {
    if (!position || !market) return 0;
    
    const effectiveStake = position.effective_stake;
    
    if (position.direction) {
      // 看涨方向，使用 total_a_effective_stake
      const totalAStake = market.total_a_effective_stake;
      return totalAStake > 0 ? (effectiveStake / totalAStake) * 100 : 0;
    } else {
      // 看跌方向，使用 total_b_effective_stake
      const totalBStake = market.total_b_effective_stake;
      return totalBStake > 0 ? (effectiveStake / totalBStake) * 100 : 0;
    }
  };

  // 计算赔率
  const getOdds = (side: 'a' | 'b') => {
    const total = poolABalance + poolBBalance;
    
    if (total === 0) return 1.0;
    
    if (side === 'a') {
      return poolABalance > 0 ? total / poolABalance : 1.0;
    } else {
      return poolBBalance > 0 ? total / poolBBalance : 1.0;
    }
  };

  // 检查是否可以领取奖金
  const canClaimWinnings = () => {
    if (!market || !position || !connected) return false;
    return !market.status && 
           market.winning_side !== null && 
           market.winning_side === position.direction;
  };

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            My Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Please connect wallet to view position information
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            My Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <div className="text-muted-foreground">Loading position information...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasPosition || !position) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            My Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-muted-foreground mb-4">
              You have no position in this market
            </div>
            <Button
              onClick={fetchUserPosition}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ownershipPercentage = calculateOwnershipPercentage();
  const odds = getOdds(position.direction ? 'a' : 'b');
  const potentialWinnings = (position.effective_stake * odds / 1000000000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          My Position
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Direction</div>
            <Badge variant={position.direction ? "default" : "destructive"}>
              {position.direction ? "Bullish" : "Bearish"}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Stake Amount</div>
            <div className="font-medium">{formatStake(position.stake_amount)} tokens</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Effective Stake</div>
            <div className="font-medium">{formatStake(position.effective_stake)} tokens</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Ownership %</div>
            <div className="font-medium text-blue-600">
              {ownershipPercentage.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Current Odds</div>
              <div className="font-medium">{odds.toFixed(2)}x</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Potential Winnings</div>
              <div className="font-medium text-green-600">
                {potentialWinnings.toFixed(2)} tokens
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {canClaimWinnings() && onClaimWinnings && (
            <Button
              className="flex-1"
              onClick={onClaimWinnings}
            >
              Claim Winnings
            </Button>
          )}
          
          <Button
            onClick={fetchUserPosition}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}