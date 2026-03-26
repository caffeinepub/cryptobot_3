import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BotConfig, LogEntry } from "../backend.d";
import { useActor } from "./useActor";

export function useBotState() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["botState"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getBotState();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isRunning ? 5000 : 10000;
    },
    enabled: !!actor && !isFetching,
    staleTime: 4000,
  });
}

export function useOpenTrades() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["openTrades"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getOpenTradesSorted();
    },
    refetchInterval: 10000,
    staleTime: 9000,
    enabled: !!actor && !isFetching,
  });
}

export function useAllTrades() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["allTrades"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllTradeCountSorted();
    },
    refetchInterval: 15000,
    staleTime: 14000,
    enabled: !!actor && !isFetching,
  });
}

export function usePnLSummary() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["pnlSummary"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPnLSummary();
    },
    refetchInterval: 10000,
    staleTime: 9000,
    enabled: !!actor && !isFetching,
  });
}

export function useIsAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    staleTime: 60000,
    enabled: !!actor && !isFetching,
  });
}

export function useStartBot() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.startBot();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["botState"] }),
  });
}

export function useStopBot() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.stopBot();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["botState"] }),
  });
}

export function useManualTick() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.manualTick();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["botState"] });
      qc.invalidateQueries({ queryKey: ["openTrades"] });
      qc.invalidateQueries({ queryKey: ["allTrades"] });
    },
  });
}

export function useConfigure() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: BotConfig) => {
      if (!actor) throw new Error("Not connected");
      return actor.configure(config);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["botState"] }),
  });
}

export function useAddCapital() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) => {
      if (!actor) throw new Error("Not connected");
      return actor.addCapital(amount);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["botState"] }),
  });
}

export function useResetBot() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.resetBot();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["botState"] });
      qc.invalidateQueries({ queryKey: ["openTrades"] });
      qc.invalidateQueries({ queryKey: ["allTrades"] });
      qc.invalidateQueries({ queryKey: ["pnlSummary"] });
    },
  });
}

// Cast to any because getLogs/clearLogs are new backend methods not yet
// reflected in the auto-generated backend.ts backendInterface type.
type ActorWithLogs = {
  getLogs(): Promise<LogEntry[]>;
  clearLogs(): Promise<void>;
};

export function useLogs() {
  const { actor, isFetching } = useActor();
  const { data: botState } = useBotState();
  return useQuery<LogEntry[]>({
    queryKey: ["logs"],
    queryFn: async () => {
      if (!actor) return [];
      return (actor as unknown as ActorWithLogs).getLogs();
    },
    refetchInterval: () => {
      return botState?.isRunning ? 5000 : 15000;
    },
    staleTime: 4000,
    enabled: !!actor && !isFetching,
  });
}

export function useClearLogs() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return (actor as unknown as ActorWithLogs).clearLogs();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] }),
  });
}
