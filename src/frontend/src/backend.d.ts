import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface BotState {
    rsi: number;
    lastPrice: number;
    consecutiveLosses: bigint;
    ema200: number;
    ema50: number;
    totalPnL: number;
    capital: number;
    isRunning: boolean;
    openTradesCount: bigint;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface BotConfig {
    pair: string;
    maxTrades: bigint;
    apiKey: string;
    apiSecret: string;
    capital: number;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Trade {
    id: bigint;
    pnl?: number;
    status: string;
    closeTime?: bigint;
    pair: string;
    size: number;
    entryPrice: number;
    closeReason?: string;
    exitPrice?: number;
    openTime: bigint;
}
export interface PnLSummary {
    totalTrades: bigint;
    totalPnL: number;
    winningTrades: bigint;
    winRate: number;
}
export interface UserProfile {
    name: string;
}
export interface LogEntry {
    timestamp: bigint;
    level: string;
    message: string;
}
export interface http_header {
    value: string;
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addCapital(amount: number): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    clearLogs(): Promise<void>;
    closeTrade(id: bigint, profit: number, closeReason: string): Promise<[bigint, number]>;
    configure(newConfig: BotConfig): Promise<void>;
    getAllTradeCountSorted(): Promise<Array<Trade>>;
    getAllTradesSortedByTradeSize(): Promise<Array<Trade>>;
    getBotState(): Promise<BotState>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getLogs(): Promise<Array<LogEntry>>;
    getOpenTradesByTradeSize(): Promise<Array<Trade>>;
    getOpenTradesCount(): Promise<Array<Trade>>;
    getOpenTradesSorted(): Promise<Array<Trade>>;
    getPnLSummary(): Promise<PnLSummary>;
    getTradeCount(): Promise<Array<Trade>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    manualTick(): Promise<string>;
    resetBot(): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    startBot(): Promise<void>;
    stopBot(): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
