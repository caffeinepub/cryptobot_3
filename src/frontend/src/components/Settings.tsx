import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Plus, RefreshCw, Save } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useAddCapital,
  useBotState,
  useConfigure,
  useResetBot,
} from "../hooks/useQueries";

export default function Settings() {
  const { data: botState } = useBotState();

  const [pair, setPair] = useState("BTCUSDT");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [capital, setCapital] = useState("10000");
  const [maxTrades, setMaxTrades] = useState("5");
  const [addAmount, setAddAmount] = useState("");

  const configure = useConfigure();
  const addCapital = useAddCapital();
  const resetBot = useResetBot();

  const handleSave = async () => {
    try {
      await configure.mutateAsync({
        pair,
        apiKey,
        apiSecret,
        capital: Number.parseFloat(capital),
        maxTrades: BigInt(Number.parseInt(maxTrades)),
      });
      toast.success("Configuration saved");
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
    }
  };

  const handleAddCapital = async () => {
    const amount = Number.parseFloat(addAmount);
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await addCapital.mutateAsync(amount);
      toast.success(`Added $${amount.toFixed(2)} to capital`);
      setAddAmount("");
    } catch (e) {
      toast.error(`Failed to add capital: ${e}`);
    }
  };

  const handleReset = async () => {
    try {
      await resetBot.mutateAsync();
      toast.success("Bot reset successfully");
    } catch (e) {
      toast.error(`Failed to reset: ${e}`);
    }
  };

  return (
    <div className="space-y-6" data-ocid="settings.panel">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">
          Settings
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Configure your trading bot
        </p>
      </div>

      {/* Bot Config */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card-panel p-6"
      >
        <h2 className="mb-5 text-[11px] font-bold uppercase tracking-widest text-foreground">
          Bot Configuration
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="pair"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Trading Pair
            </Label>
            <Input
              id="pair"
              data-ocid="settings.pair.input"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              placeholder="BTCUSDT"
              className="mono border-border bg-muted/30 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="capital"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Starting Capital ($)
            </Label>
            <Input
              id="capital"
              data-ocid="settings.capital.input"
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              placeholder="10000"
              className="mono border-border bg-muted/30 text-sm"
            />
            {botState && (
              <p className="text-[11px] text-muted-foreground">
                Current:{" "}
                <span className="mono text-foreground">
                  $
                  {botState.capital.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="maxTrades"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Max Open Trades
            </Label>
            <Input
              id="maxTrades"
              data-ocid="settings.max_trades.input"
              type="number"
              min="1"
              max="10"
              value={maxTrades}
              onChange={(e) => setMaxTrades(e.target.value)}
              placeholder="5"
              className="mono border-border bg-muted/30 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="apiKey"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Exchange API Key
            </Label>
            <Input
              id="apiKey"
              data-ocid="settings.api_key.input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your API key"
              className="mono border-border bg-muted/30 text-sm"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label
              htmlFor="apiSecret"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Exchange API Secret
            </Label>
            <Input
              id="apiSecret"
              data-ocid="settings.api_secret.input"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Your API secret (masked)"
              className="mono border-border bg-muted/30 text-sm"
            />
          </div>
        </div>

        <div className="mt-6">
          <Button
            data-ocid="settings.save.submit_button"
            onClick={handleSave}
            disabled={configure.isPending}
            className="gap-2 border border-success/30 bg-success/10 text-success hover:bg-success/20"
            variant="ghost"
          >
            {configure.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Configuration
          </Button>
        </div>
      </motion.div>

      {/* Add Capital */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="card-panel p-6"
      >
        <h2 className="mb-5 text-[11px] font-bold uppercase tracking-widest text-foreground">
          Add Capital
        </h2>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label
              htmlFor="addCapital"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Amount ($)
            </Label>
            <Input
              id="addCapital"
              data-ocid="settings.add_capital.input"
              type="number"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              placeholder="1000"
              className="mono border-border bg-muted/30 text-sm"
            />
          </div>
          <Button
            data-ocid="settings.add_capital.primary_button"
            onClick={handleAddCapital}
            disabled={addCapital.isPending}
            className="gap-2 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
            variant="ghost"
          >
            {addCapital.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </Button>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="card-panel border-danger/20 p-6"
      >
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-danger">
          Danger Zone
        </h2>
        <p className="mb-5 text-xs text-muted-foreground">
          These actions are irreversible. Resetting will stop the bot and clear
          all trade history.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              data-ocid="settings.reset.open_modal_button"
              variant="ghost"
              className="gap-2 border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
            >
              <AlertTriangle className="h-4 w-4" />
              Reset Bot
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent
            data-ocid="settings.reset.dialog"
            className="border-border bg-card"
          >
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                Reset Bot?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will stop the bot, clear all trade history, and reset
                capital. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                data-ocid="settings.reset.cancel_button"
                className="border-border bg-muted/30 text-foreground hover:bg-muted/50"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                data-ocid="settings.reset.confirm_button"
                onClick={handleReset}
                className="border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
              >
                {resetBot.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Reset Bot
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>

      {/* Strategy Reference */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="card-panel p-6"
      >
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-foreground">
          Strategy Reference
        </h2>
        <div className="grid gap-4 text-xs md:grid-cols-3">
          <div className="space-y-2">
            <div className="font-semibold uppercase tracking-wider text-muted-foreground">
              Entry Rules
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex gap-1.5">
                <span className="text-success">▸</span> EMA50 &gt; EMA200
                (bullish)
              </li>
              <li className="flex gap-1.5">
                <span className="text-success">▸</span> RSI(14) &lt; 40
              </li>
              <li className="flex gap-1.5">
                <span className="text-success">▸</span> Price within 1% of EMA50
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-semibold uppercase tracking-wider text-muted-foreground">
              Exit Rules
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex gap-1.5">
                <span className="text-warning">▸</span> Take profit: +5%
              </li>
              <li className="flex gap-1.5">
                <span className="text-danger">▸</span> Stop loss: -3.5%
              </li>
              <li className="flex gap-1.5">
                <span className="text-warning">▸</span> Trailing stop: +3%
                activate
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-semibold uppercase tracking-wider text-muted-foreground">
              Risk Management
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex gap-1.5">
                <span className="text-primary">▸</span> Max 3% risk per trade
              </li>
              <li className="flex gap-1.5">
                <span className="text-primary">▸</span> Max 10 open trades
              </li>
              <li className="flex gap-1.5">
                <span className="text-primary">▸</span> Stop after 5 consecutive
                losses
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
