"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Plus } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { CreateMarketForm } from "@/lib/type/market";

const FormSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
  closeTime: z.string().min(1, "Close time is required"),
  tokenMetadata: z.string().min(1, "Token metadata address is required"),
});

interface CreateMarketProps {
  onMarketCreated?: (description: string, closeTime: Date, tokenMetadata: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function CreateMarket({ onMarketCreated, onCancel, isLoading }: CreateMarketProps) {
  const { toast } = useToast();
  const { connected, account } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current date + 1 week as default
  const getDefaultCloseTime = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 16); // Format for datetime-local
  };

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      description: "",
      closeTime: getDefaultCloseTime(),
      tokenMetadata: "0x1::aptos_coin::AptosCoin",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (!account) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    // Validate close time is in the future
    const closeTimeDate = new Date(data.closeTime);
    if (closeTimeDate <= new Date()) {
      toast({
        title: "Error",
        description: "Close time must be in the future",
        variant: "destructive",
      });
      return;
    }

    if (onMarketCreated) {
      // Call parent handler directly
      onMarketCreated(data.description, closeTimeDate, data.tokenMetadata);
    } else {
      // Fallback for standalone usage
      setIsSubmitting(true);
      
      try {
        console.log("Creating market with data:", {
          description: data.description,
          closeTime: Math.floor(closeTimeDate.getTime() / 1000),
          tokenMetadata: data.tokenMetadata,
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        toast({
          title: "Success",
          description: "Market created successfully!",
        });

        form.reset({
          description: "",
          closeTime: getDefaultCloseTime(),
          tokenMetadata: "0x1::aptos_coin::AptosCoin",
        });
        
      } catch (error) {
        console.error("Error creating market:", error);
        toast({
          title: "Error",
          description: "Failed to create market. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create New Market
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Market Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Will Bitcoin reach $100,000 by the end of 2024?"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide a clear, specific question that can be answered with Yes/No
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="closeTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Market Close Time</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    When should this market stop accepting new positions?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tokenMetadata"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token Metadata Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x1::aptos_coin::AptosCoin"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The fungible asset metadata object address for the token used in this market
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={!connected || isSubmitting || isLoading}
                className="flex-1"
              >
                {(isSubmitting || isLoading) ? "Creating..." : "Create Market"}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting || isLoading}
                >
                  Cancel
                </Button>
              )}
            </div>

            {!connected && (
              <p className="text-sm text-muted-foreground text-center">
                Please connect your wallet to create a market
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}