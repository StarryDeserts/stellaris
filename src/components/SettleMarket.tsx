"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Gavel, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { MarketView } from "@/lib/type/market";
import { LabelValueGrid } from "@/components/LabelValueGrid";
import { ObjectOnExplorer } from "@/components/ExplorerLink";

const FormSchema = z.object({
  winningSide: z.enum(["true", "false"], {
    required_error: "Please select the winning side",
  }),
});

interface SettleMarketProps {
  market: MarketView;
  onMarketSettled?: (marketId: string, winningSide: boolean) => void;
  onCancel?: () => void;
}

export function SettleMarket({ 
  market, 
  onMarketSettled, 
  onCancel 
}: SettleMarketProps) {
  const { toast } = useToast();
  const { connected, account } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const formatStake = (stake: string | number) => {
    const num = (typeof stake === 'string' ? parseInt(stake) : stake) / 1000000000; // Assuming 9 decimals
    return num.toFixed(2);
  };

  const formatTime = (timestamp: string | number) => {
    return new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp).toLocaleString();
  };

  const canSettle = () => {
    const closeTime = typeof market.close_time === 'string' ? parseInt(market.close_time) : market.close_time;
    return (
      market.status &&
      closeTime <= Date.now() &&
      market.winning_side === null
    );
  };

  const getTotalStake = () => {
    const totalA = typeof market.total_a_effective_stake === 'string' ? parseInt(market.total_a_effective_stake) : market.total_a_effective_stake;
    const totalB = typeof market.total_b_effective_stake === 'string' ? parseInt(market.total_b_effective_stake) : market.total_b_effective_stake;
    return totalA + totalB;
  };

  const getWinnerInfo = (winningSide: boolean) => {
    const winningStake = winningSide ? market.total_a_effective_stake : market.total_b_effective_stake;
    const losingStake = winningSide ? market.total_b_effective_stake : market.total_a_effective_stake;
    const totalStake = getTotalStake();
    
    const winningStakeNum = typeof winningStake === 'string' ? parseInt(winningStake) : winningStake;
    
    return {
      winningStake: formatStake(winningStake),
      losingStake: formatStake(losingStake),
      totalStake: formatStake(totalStake.toString()),
      winnerCount: winningSide ? "Side A" : "Side B",
      payout: totalStake > 0 ? (totalStake / winningStakeNum) : 1,
    };
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

    if (!canSettle()) {
      toast({
        title: "Error",
        description: "This market cannot be settled at this time",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const winningSide = data.winningSide === "true";
      
      // TODO: Implement actual contract call
      // This is where you would call the settle_market function
      console.log("Settling market with data:", {
        marketId: market.id,
        winningSide,
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Success",
        description: `Market settled successfully! ${winningSide ? 'Side A (Yes)' : 'Side B (No)'} won.`,
      });

      // Reset form
      form.reset();
      
      // Notify parent component
      onMarketSettled?.(market.id, winningSide);
      
    } catch (error) {
      console.error("Error settling market:", error);
      toast({
        title: "Error",
        description: "Failed to settle market. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedWinningSide = form.watch("winningSide");
  const winnerInfo = selectedWinningSide ? getWinnerInfo(selectedWinningSide === "true") : null;

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
          <Gavel className="h-5 w-5" />
          Settle Market
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-orange-700 dark:text-orange-300 mb-1">
              Admin Action Required
            </p>
            <p className="text-orange-600 dark:text-orange-400">
              This market has closed and needs to be settled. Please carefully review the market question and select the correct winning side.
            </p>
          </div>
        </div>

        {/* Market Info */}
        <div>
          <h4 className="font-medium mb-2">Market Question</h4>
          <p className="text-sm text-muted-foreground mb-4">{market.description}</p>
          
          <LabelValueGrid
            items={[
              {
                label: "Market ID",
                value: <ObjectOnExplorer address={market.id} />,
              },
              {
                label: "Created",
                value: formatTime(market.create_time),
              },
              {
                label: "Closed",
                value: formatTime(market.close_time),
              },
              {
                label: "Status",
                value: (
                  <Badge variant={canSettle() ? "destructive" : "secondary"}>
                    {canSettle() ? "Needs Settlement" : "Already Settled"}
                  </Badge>
                ),
              },
            ]}
          />
        </div>

        {/* Current Stakes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <h4 className="font-medium text-green-700 dark:text-green-300">
                Side A (Yes)
              </h4>
            </div>
            <div className="text-2xl font-bold mb-1">
              {formatStake(market.total_a_effective_stake)} tokens
            </div>
            <div className="text-sm text-muted-foreground">
              Total stake on &quot;Yes&quot;
            </div>
          </div>

          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <h4 className="font-medium text-red-700 dark:text-red-300">
                Side B (No)
              </h4>
            </div>
            <div className="text-2xl font-bold mb-1">
              {formatStake(market.total_b_effective_stake)} tokens
            </div>
            <div className="text-sm text-muted-foreground">
              Total stake on &quot;No&quot;
            </div>
          </div>
        </div>

        {canSettle() && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="winningSide"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-base font-medium">
                      Select the Winning Side
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-1 gap-4"
                      >
                        <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20">
                          <RadioGroupItem value="true" id="side-a" />
                          <label
                            htmlFor="side-a"
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium text-green-700 dark:text-green-300">
                              Side A (Yes) Wins
                            </div>
                            <div className="text-sm text-muted-foreground">
                              The market question should be answered &quot;Yes&quot;
                            </div>
                          </label>
                        </div>
                        <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          <RadioGroupItem value="false" id="side-b" />
                          <label
                            htmlFor="side-b"
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium text-red-700 dark:text-red-300">
                              Side B (No) Wins
                            </div>
                            <div className="text-sm text-muted-foreground">
                              The market question should be answered &quot;No&quot;
                            </div>
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      Carefully review the market question and select the correct outcome.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Settlement Preview */}
              {winnerInfo && (
                <div className="p-4 bg-background/50 rounded-lg border">
                  <h4 className="font-medium mb-3">Settlement Preview</h4>
                  <LabelValueGrid
                    items={[
                      {
                        label: "Winning Side",
                        value: (
                          <Badge variant={selectedWinningSide === "true" ? "default" : "destructive"}>
                            {winnerInfo.winnerCount}
                          </Badge>
                        ),
                      },
                      {
                        label: "Winning Stake",
                        value: `${winnerInfo.winningStake} tokens`,
                      },
                      {
                        label: "Losing Stake",
                        value: `${winnerInfo.losingStake} tokens`,
                      },
                      {
                        label: "Payout Multiplier",
                        value: `${winnerInfo.payout.toFixed(2)}x`,
                      },
                    ]}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={!connected || isSubmitting}
                  className="flex-1"
                  variant="destructive"
                >
                  {isSubmitting ? "Settling..." : "Settle Market"}
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
                  Please connect your wallet to settle the market
                </p>
              )}
            </form>
          </Form>
        )}

        {!canSettle() && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {market.winning_side !== null
                ? "This market has already been settled"
                : "This market is not ready for settlement"
              }
            </p>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
              >
                Close
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}