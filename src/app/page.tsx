"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { WalletSelector } from "@/components/wallet/WalletSelector";
import { useStellaris } from "@/contract";
import { STELLARIS_MODULE_ADDRESS } from "@/constant";

interface Token {
  symbol: string;
  label: string;
  color: string;
}

interface TokenPickerProps {
  tokens: Token[];
  onPick: (symbol: string) => void;
  disabledSymbols?: string[];
}

interface GirlSketchProps {
  stage: string;
  leftCoin: string | null;
  rightCoin: string | null;
  rightCoinVisible?: boolean;
}

const TOKENS: Token[] = [
  { symbol: "BTC", label: "BTC", color: "#F2A900" },
  { symbol: "sthAPT", label: "sthAPT", color: "#1E90FF" },
  { symbol: "ETH", label: "ETH", color: "#3C3C3D" },
  { symbol: "SY-sthAPT", label: "SY-sthAPT", color: "#2775CA" },
];

// Stage types: "connectWallet" | "askGive" | "leftRetract" | "offerReceive" | "rightPresent" | "complete"
type Stage = "connectWallet" | "askGive" | "leftRetract" | "offerReceive" | "rightPresent" | "complete";

export default function StellarisWeddingSwap() {
  const [stage, setStage] = useState<Stage>("connectWallet");
  const [userGives, setUserGives] = useState<string | null>(null);
  const [userGets, setUserGets] = useState<string | null>(null);
  const [rightCoinVisible, setRightCoinVisible] = useState<boolean>(true);
  const [tvl, setTvl] = useState<number>(99929838);

  const { account, connected } = useWallet();
  const stellaris = useStellaris();

  // Romantic quotes for bubbles
  const romanticQuotes = [
    "眼底尽是你",
    "今夜月色刚好", 
    "眉间有星河",
    "风起一帘梦",
    "与君共良宵",
    "为你留盏灯",
    "想把星星给你",
    "路过你的心事",
    "借我一寸肩",
    "别来拥我一下"
  ];

  // Simple stage controller
  useEffect(() => {
    if (stage === "leftRetract") {
      const t = setTimeout(() => setStage("offerReceive"), 900);
      return () => clearTimeout(t);
    }
    if (stage === "rightPresent") {
      const t = setTimeout(() => setStage("complete"), 1100);
      return () => clearTimeout(t);
    }
  }, [stage]);

  // Right coin auto fade effect
  useEffect(() => {
    if (stage === "offerReceive") {
      setRightCoinVisible(true);
      const fadeTimer = setTimeout(() => {
        setRightCoinVisible(false);
      }, 4000);
      return () => clearTimeout(fadeTimer);
    }
  }, [stage]);

  // TVL auto increment effect
  useEffect(() => {
    const tvlInterval = setInterval(() => {
      const increment = Math.floor(Math.random() * 3) + 1;
      setTvl(prevTvl => prevTvl + increment);
    }, 1000);

    return () => clearInterval(tvlInterval);
  }, []);

  const reset = () => {
    setStage("connectWallet");
    setUserGives(null);
    setUserGets(null);
    setRightCoinVisible(true);
  };

  // Handle wallet connection
  useEffect(() => {
    if (connected && stage === "connectWallet") {
      setStage("askGive");
    }
  }, [connected, stage]);

  // Handle swap completion
  const handleSwapComplete = async () => {
    if (!account || !userGives || !userGets) return;

    try {
      // Initialize position if needed
      const [userPosition] = await stellaris.pyPosGetUserPositionAddress(account.address.toString());
      
      // Example swap call (you'll need to adjust parameters based on your needs)
      await stellaris.syDeposit(
        10000000000, // min_yt_out
        "0x3c3ffefdbe515253e1df9996877cd9715c7bd0002c87036e1a8067c8586b5e36", // py_state_object - needs to be determined
        "0x808966458820b41fbc3ebcbfd855535936f861dc176fbd507ee1eafe4a06f110", // market_pool_object - needs to be determined
      );
    } catch (error) {
      console.error("Swap failed:", error);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white text-neutral-900 flex flex-col items-center justify-start relative overflow-hidden">
      {/* TVL Banner */}
      <div className="w-full bg-neutral-100 border-b border-neutral-200 py-3 px-6 text-center">
        <div className="text-sm font-medium text-neutral-700">
          Stellaris已收到的信物 (TVL) <span className="font-bold text-neutral-900">{tvl.toLocaleString()} USD</span>
        </div>
      </div>
      
      <div className="flex-1 w-full p-6 sm:p-10">
        {/* Paper grain */}
        <div className="pointer-events-none absolute inset-0 opacity-50 mix-blend-multiply" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)", backgroundSize: "6px 6px" }} />

        <div className="max-w-6xl w-full mx-auto">
          {/* Header */}
          <header className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">Stellaris Wedding</h1>
            <div className="text-xs sm:text-sm opacity-80">
              一次Swap，一次承诺，尽在<strong className="mx-1 animate-pulse">AptOS</strong>.
            </div>
          </header>

          <div className="grid grid-cols-1 gap-10 items-center justify-items-center">
            {/* Left: Illustration */}
            <div className="relative">
              <div className="[perspective:1000px]">
                <GirlSketch
                  stage={stage}
                  leftCoin={userGives}
                  rightCoin={userGets}
                  rightCoinVisible={rightCoinVisible}
                />
              </div>
              <FloatingBubbles quotes={romanticQuotes} />
            </div>

            {/* Right: Controls & copy */}
            <div className="space-y-6 mt-12">
              <div className="bg-white/80 rounded-2xl shadow-sm border border-neutral-200 p-5 relative">
                {/* Sketchy corner accents */}
                <div className="absolute -top-1 left-2 h-3 w-10 border-t border-neutral-800/30" />
                <div className="absolute -bottom-1 right-2 h-3 w-10 border-b border-neutral-800/30" />

                <AnimatePresence mode="wait">
                  {stage === "connectWallet" && (
                    <motion.div
                      key="connectWallet"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Horizontal Layout */}
                      <div className="flex items-center gap-6">
                        {/* Position Status - Left Side */}
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-neutral-600 mb-3">
                            Stellaris希望您做出选择
                          </h3>
                          <div className="flex gap-3 text-xs">
                            <div className="bg-neutral-50 rounded-lg p-2 text-center flex-1">
                              <div className="text-neutral-500 mb-1">PT</div>
                              <div className="font-bold text-neutral-900">1,234.56</div>
                            </div>
                            <div className="bg-neutral-50 rounded-lg p-2 text-center flex-1">
                              <div className="text-neutral-500 mb-1">YT</div>
                              <div className="font-bold text-neutral-900">987.32</div>
                            </div>
                            <div className="bg-neutral-50 rounded-lg p-2 text-center flex-1">
                              <div className="text-neutral-500 mb-1">LP</div>
                              <div className="font-bold text-neutral-900">456.78</div>
                            </div>
                          </div>
                        </div>

                        {/* Wallet Connection - Right Side */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="text-left">
                              <p className="text-lg font-medium mb-1 whitespace-nowrap">
                                让<strong>她</strong>走进你的内心？
                              </p>
                              <p className="text-xs text-neutral-500">
                                这将链接到你的钱包
                              </p>
                            </div>
                            <WalletSelector />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {stage === "askGive" && (
                    <motion.div
                      key="askGive"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-4"
                    >
                      <p className="text-lg font-medium">
                        请选择你想要与<strong className="mx-1">Stellaris</strong>厮守一生的信物
                      </p>
                      <TokenPicker
                        tokens={TOKENS}
                        onPick={(sym) => {
                          setUserGives(sym);
                          setStage("leftRetract");
                        }}
                        disabledSymbols={userGets ? [userGets] : []}
                      />
                    </motion.div>
                  )}

                  {stage === "offerReceive" && (
                    <motion.div
                      key="offerReceive"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-4"
                    >
                      <p className="text-lg font-medium">
                        Stellaris同样也赠予你信物
                      </p>
                      <TokenPicker
                        tokens={TOKENS}
                        onPick={(sym) => {
                          setUserGets(sym);
                          setStage("rightPresent");
                        }}
                        disabledSymbols={userGives ? [userGives] : []}
                      />
                    </motion.div>
                  )}

                  {stage === "complete" && (
                    <motion.div
                      key="complete"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-4"
                    >
                      <p className="text-xl font-semibold">承诺已达成</p>
                      <p className="text-sm opacity-80">
                        你将 <strong>{userGives}</strong> 交予 Stellaris，换得 <strong>{userGets}</strong>。
                      </p>
                      <div className="flex gap-3">
                        <button onClick={reset} className="px-4 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 transition">
                          再次交换
                        </button>
                        <button 
                          onClick={handleSwapComplete}
                          className="px-4 py-2 rounded-xl border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 transition"
                        >
                          确认交换
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          
          {/* Fixed center description */}
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 text-sm opacity-70 leading-relaxed text-center">
            每一次选择，都是一次承诺
          </div>
        </div>
      </div>

      {/* Local CSS for sketch feel & hair sway */}
      <style>{`
        @keyframes hair-sway {
          0% { transform: rotate(0deg); }
          50% { transform: rotate(3deg); }
          100% { transform: rotate(0deg); }
        }
        .sketch-stroke { stroke: #111; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
        .sketch-fill { fill: rgba(0,0,0,0.02); }
        .sketch-shadow { filter: drop-shadow(0 1px 0 rgba(0,0,0,0.2)) drop-shadow(0 6px 12px rgba(0,0,0,0.06)); }
      `}</style>
    </div>
  );
}

// Component implementations (TokenPicker, CoinSketch, FloatingBubbles, GirlSketch) remain the same
// but with TypeScript types added...

function TokenPicker({ tokens, onPick, disabledSymbols = [] }: TokenPickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tokens.map((t) => {
        const disabled = disabledSymbols.includes(t.symbol);
        return (
          <button
            key={t.symbol}
            disabled={disabled}
            onClick={() => onPick(t.symbol)}
            className={`group relative overflow-hidden rounded-2xl border ${
              disabled ? "border-neutral-200 opacity-40 cursor-not-allowed" : "border-neutral-300 hover:border-neutral-800 hover:-translate-y-0.5"
            } transition-transform bg-white p-3 text-left`}
          >
            <div className="flex items-center gap-3">
              <CoinSketch symbol={t.symbol} color={t.color} className="h-8 w-8 shrink-0" />
              <div className="font-medium">{t.label}</div>
            </div>
            <div className="absolute bottom-0 right-0 h-8 w-12 opacity-20">
              <svg viewBox="0 0 60 40" className="h-full w-full">
                <path d="M2 30 Q20 10 38 26 T58 22" className="sketch-stroke" fill="none" />
              </svg>
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface CoinSketchProps {
  symbol: string;
  color: string;
  className?: string;
}

function CoinSketch({ symbol, color, className }: CoinSketchProps) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <defs>
        <radialGradient id={`g-${symbol}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor={color} stopOpacity="0.25" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill={`url(#g-${symbol})`} className="sketch-stroke" />
      <circle cx="32" cy="32" r="28" fill="none" className="sketch-stroke" />
      <text x="32" y="38" textAnchor="middle" fontSize="18" fontFamily="ui-monospace, monospace">{symbol}</text>
    </svg>
  );
}

interface FloatingBubblesProps {
  quotes: string[];
}

function FloatingBubbles({ quotes }: FloatingBubblesProps) {
  const [activeBubbles, setActiveBubbles] = useState<Array<{
    id: string;
    quote: string;
    x: number;
    y: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    const isPositionTooClose = (newX: number, newY: number, existingBubbles: typeof activeBubbles) => {
      return existingBubbles.some(bubble => {
        const distance = Math.sqrt(
          Math.pow(newX - bubble.x, 2) + Math.pow(newY - bubble.y, 2)
        );
        return distance < 25;
      });
    };

    const createBubble = () => {
      setActiveBubbles(prev => {
        if (prev.length >= 2) return prev;

        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        const id = Math.random().toString(36).substr(2, 9);
        
        let x: number, y: number;
        let attempts = 0;
        
        do {
          x = Math.random() * 80 + 10;
          y = Math.random() * 80 + 10;
          attempts++;
        } while (isPositionTooClose(x, y, prev) && attempts < 10);
        
        const bubble = { id, quote, x, y, delay: Math.random() * 1000 };
        
        setTimeout(() => {
          setActiveBubbles(current => current.filter(b => b.id !== id));
        }, 6000);
        
        return [...prev, bubble];
      });
    };

    const initialDelay = setTimeout(() => {
      createBubble();
    }, 500);

    const interval = setInterval(() => {
      createBubble();
    }, 2000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [quotes]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {activeBubbles.map(bubble => (
        <motion.div
          key={bubble.id}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ 
            opacity: [0, 1, 1, 0], 
            scale: [0.8, 1, 1, 0.9],
            y: [20, 0, 0, -10]
          }}
          transition={{ 
            duration: 6,
            delay: bubble.delay / 1000,
            times: [0, 0.2, 0.8, 1]
          }}
          className="absolute"
          style={{ 
            left: `${bubble.x}%`, 
            top: `${bubble.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg border border-pink-100">
            <span className="text-xs font-medium text-neutral-700 whitespace-nowrap">
              {bubble.quote}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function GirlSketch({ stage, leftCoin, rightCoin, rightCoinVisible = true }: GirlSketchProps) {
  const leftExtended = stage === "askGive";
  const leftRetracting = stage === "leftRetract";
  const rightExtending = stage === "offerReceive" || stage === "rightPresent";

  const zOut = { scale: 1.08, translateY: -6 };

  return (
    <div className="relative w-full max-w-[720px] mx-auto">
      <svg viewBox="0 0 1000 900" className="w-full h-auto sketch-shadow">
        {/* SVG content remains the same... */}
      </svg>
    </div>
  );
}
