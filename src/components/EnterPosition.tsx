"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TrendingUp, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EnterPositionForm, MarketView } from "@/lib/type/market";

const FormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    "Amount must be a positive number"
  ),
});

interface EnterPositionProps {
  market: MarketView;
  direction: boolean; // true for A (Yes), false for B (No)
  onPositionEntered?: (marketId: string, direction: boolean, amount: string) => void;
  onCancel?: () => void;
}

export function EnterPosition({ 
  market, 
  direction, 
  onPositionEntered, 
  onCancel 
}: EnterPositionProps) {
  const { toast } = useToast();
  const { connected, account } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      amount: "",
    },
  });

  const formatStake = (stake: string | number) => {
    const num = (typeof stake === 'string' ? parseInt(stake) : stake) / 1000000000; // Assuming 9 decimals
    return num.toFixed(2);
  };

  const calculateOdds = () => {
    const totalA = market.total_a_effective_stake;
    const totalB = market.total_b_effective_stake;
    const total = totalA + totalB;
    
    if (total === 0) return 1.0;
    
    if (direction) {
      return total / totalA || 1.0;
    } else {
      return total / totalB || 1.0;
    }
  };

  const calculatePotentialPayout = (amount: string) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) return 0;
    return amountNum * calculateOdds();
  };

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (!account) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    // Check if market is still active
    if (!market.status || market.close_time <= Date.now()) {
      toast({
        title: "Error",
        description: "This market is no longer accepting positions",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 调用真实的合约方法
      console.log("Entering position with data:", {
        marketId: market.id,
        direction,
        amount: data.amount,
      });

      // Convert amount to proper format (assuming 9 decimals)
      const amountInTokens = (parseFloat(data.amount) * 1000000000).toString();

      // 这里应该调用 usePredictionMarket hook 中的 enterPosition 方法
      // 但由于这个组件没有直接访问 hook，我们通过 onPositionEntered 回调来处理
      if (onPositionEntered) {
        onPositionEntered(market.id, direction, data.amount);
        
        toast({
          title: "Success",
          description: `Position entered successfully! You bet ${data.amount} tokens on ${direction ? 'Yes' : 'No'}`,
        });

        // Reset form
        form.reset();
      } else {
        // 如果没有回调，显示提示信息
        toast({
          title: "Info",
          description: "Please use the betting interface in the main page to enter positions",
        });
      }
      
    } catch (error) {
      console.error("Error entering position:", error);
      toast({
        title: "Error",
        description: "Failed to enter position. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentAmount = form.watch("amount");
  const potentialPayout = calculatePotentialPayout(currentAmount);
  const odds = calculateOdds();

  const sideInfo = {
    name: direction ? "Side A (Yes)" : "Side B (No)",
    icon: direction ? TrendingUp : TrendingDown,
    color: direction ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
    bgColor: direction ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20",
    currentStake: direction ? market.total_a_effective_stake : market.total_b_effective_stake,
  };

  const Icon = sideInfo.icon;

  return (
    <Card className={sideInfo.bgColor}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${sideInfo.color}`}>
          <Icon className="h-5 w-5" />
          Enter Position - {sideInfo.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          <div className="text-sm">
            <p className="font-medium mb-2">Market Question:</p>
            <p className="text-muted-foreground">{market.description}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Current Stake</p>
              <p className="font-medium">{formatStake(sideInfo.currentStake)} tokens</p>
            </div>
            <div>
              <p className="text-muted-foreground">Current Odds</p>
              <p className="font-medium">{odds.toFixed(2)}x</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stake Amount (tokens)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the amount of tokens you want to stake
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {currentAmount && !isNaN(parseFloat(currentAmount)) && (
              <div className="p-4 bg-background/50 rounded-lg border">
                <h4 className="font-medium mb-2">Position Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Stake Amount:</span>
                    <span>{currentAmount} tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Odds:</span>
                    <span>{odds.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Potential Payout:</span>
                    <span className={sideInfo.color}>
                      {potentialPayout.toFixed(2)} tokens
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Potential Profit:</span>
                    <span>
                      {(potentialPayout - parseFloat(currentAmount)).toFixed(2)} tokens
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={!connected || isSubmitting || !market.status}
                className="flex-1"
                variant={direction ? "default" : "destructive"}
              >
                {isSubmitting ? "Entering Position..." : `Bet ${direction ? 'Yes' : 'No'}`}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
            </div>

            {!connected && (
              <p className="text-sm text-muted-foreground text-center">
                Please connect your wallet to enter a position
              </p>
            )}

            {!market.status && (
              <p className="text-sm text-destructive text-center">
                This market is no longer accepting new positions
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}