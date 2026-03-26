import Map "mo:core/Map";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Order "mo:core/Order";
import Time "mo:core/Time";
import Float "mo:core/Float";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Error "mo:core/Error";
import OutCall "http-outcalls/outcall";

import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  public query func transform(input: OutCall.TransformationInput) : async OutCall.TransformationOutput {
      OutCall.transform(input);
  };

  // Types
  public type BotConfig = {
    pair : Text;
    apiKey : Text;
    apiSecret : Text;
    capital : Float;
    maxTrades : Nat;
  };

  public type Trade = {
    id : Nat;
    pair : Text;
    entryPrice : Float;
    exitPrice : ?Float;
    size : Float;
    status : Text;
    openTime : Int;
    closeTime : ?Int;
    pnl : ?Float;
    closeReason : ?Text;
  };

  public type BotState = {
    isRunning : Bool;
    capital : Float;
    totalPnL : Float;
    openTradesCount : Nat;
    consecutiveLosses : Nat;
    lastPrice : Float;
    ema50 : Float;
    ema200 : Float;
    rsi : Float;
  };

  public type PnLSummary = {
    totalPnL : Float;
    winRate : Float;
    totalTrades : Nat;
    winningTrades : Nat;
  };

  public type UserProfile = {
    name : Text;
  };

  public type LogEntry = {
    timestamp : Int;
    level : Text;
    message : Text;
  };

  module Trade {
    public func compare(trade1 : Trade, trade2 : Trade) : Order.Order {
      Int.compare(trade1.openTime, trade2.openTime);
    };

    public func compareByTradeSize(trade1 : Trade, trade2 : Trade) : Order.Order {
      Float.compare(trade1.size, trade2.size);
    };
  };

  // Access control
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User profiles
  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // State
  var config : BotConfig = {
    pair = "BTCUSDT";
    apiKey = "";
    apiSecret = "";
    capital = 10000.0;
    maxTrades = 10;
  };

  let trades = Map.empty<Nat, Trade>();
  let nextTradeId = Map.empty<Nat, Nat>();

  var botState : {
    var isRunning : Bool;
    var capital : Float;
    var totalPnL : Float;
    var openTradesCount : Nat;
    var consecutiveLosses : Nat;
    var lastPrice : Float;
    var ema50 : Float;
    var ema200 : Float;
    var rsi : Float;
  } = {
    var isRunning = false;
    var capital = 10000.0;
    var totalPnL = 0.0;
    var openTradesCount = 0;
    var consecutiveLosses = 0;
    var lastPrice = 0.0;
    var ema50 = 0.0;
    var ema200 = 0.0;
    var rsi = 0.0;
  };

  // Logging — newest entry first, capped at maxLogSize
  let maxLogSize = 200;
  var logBuffer : [LogEntry] = [];

  func addLog(level : Text, message : Text) {
    let entry : LogEntry = {
      timestamp = Time.now();
      level;
      message;
    };
    let oldSize = logBuffer.size();
    let newSize = if (oldSize >= maxLogSize) { maxLogSize } else { oldSize + 1 };
    logBuffer := Array.tabulate<LogEntry>(newSize, func(i) {
      if (i == 0) { entry } else { logBuffer[i - 1] };
    });
  };

  public query func getLogs() : async [LogEntry] {
    logBuffer;
  };

  public shared ({ caller }) func clearLogs() : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can clear logs");
    };
    logBuffer := [];
    addLog("info", "Logs cleared by admin");
  };

  func snapshotBotState() : BotState {
    {
      isRunning = botState.isRunning;
      capital = botState.capital;
      totalPnL = botState.totalPnL;
      openTradesCount = botState.openTradesCount;
      consecutiveLosses = botState.consecutiveLosses;
      lastPrice = botState.lastPrice;
      ema50 = botState.ema50;
      ema200 = botState.ema200;
      rsi = botState.rsi;
    };
  };

  public query ({ caller }) func getAllTradesSortedByTradeSize() : async [Trade] {
    trades.values().toArray().sort(Trade.compareByTradeSize);
  };

  public query ({ caller }) func getAllTradeCountSorted() : async [Trade] {
    trades.values().toArray().sort();
  };

  // Configure
  public shared ({ caller }) func configure(newConfig : BotConfig) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can configure the bot");
    };
    config := newConfig;
    botState.capital := newConfig.capital;
    addLog("info", "Bot configured: pair=" # newConfig.pair # ", capital=" # newConfig.capital.toText());
  };

  // Start/stop
  public shared ({ caller }) func startBot() : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can start the bot");
    };
    if (botState.consecutiveLosses >= 5) {
      addLog("warning", "Start attempted but bot is halted due to 5 consecutive losses");
      Runtime.trap("Bot halted: 5 consecutive losses reached");
    };
    botState.isRunning := true;
    addLog("info", "Bot started");
  };

  public shared ({ caller }) func stopBot() : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can stop the bot");
    };
    botState.isRunning := false;
    addLog("info", "Bot stopped");
  };

  // Getters
  public query ({ caller }) func getBotState() : async BotState {
    snapshotBotState();
  };

  public query ({ caller }) func getOpenTradesCount() : async [Trade] {
    trades.values().toArray().filter(
      func(t) {
        t.status == "open"
      }
    );
  };

  public query ({ caller }) func getTradeCount() : async [Trade] {
    trades.values().toArray();
  };

  public query ({ caller }) func getOpenTradesByTradeSize() : async [Trade] {
    trades.values().toArray().filter(
      func(t) {
        t.status == "open";
      }
    ).sort(Trade.compareByTradeSize);
  };

  public query ({ caller }) func getOpenTradesSorted() : async [Trade] {
    trades.values().toArray().filter(func(t) { t.status == "open" }).sort();
  };

  public query ({ caller }) func getPnLSummary() : async PnLSummary {
    var totalPnL : Float = 0.0;
    var winningTrades = 0;
    var totalTrades = 0;

    trades.values().forEach(
      func(t) {
        switch (t.pnl) {
          case (?pnl) {
            totalPnL += pnl;
            if (pnl > 0.0) { winningTrades += 1 };
          };
          case (null) {};
        };
        if (t.status == "closed") { totalTrades += 1 };
      }
    );

    let winRate = if (totalTrades > 0) {
      winningTrades.toFloat() / totalTrades.toFloat();
    } else { 0.0 };

    {
      totalPnL;
      winRate;
      totalTrades;
      winningTrades;
    };
  };

  // Add capital
  public shared ({ caller }) func addCapital(amount : Float) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can add capital");
    };
    botState.capital := botState.capital + amount;
    addLog("info", "Capital added: $" # amount.toText() # ", new total: $" # botState.capital.toText());
  };

  // Reset
  public shared ({ caller }) func resetBot() : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can reset the bot");
    };
    botState := {
      var isRunning = false;
      var capital = config.capital;
      var totalPnL = 0.0;
      var openTradesCount = 0;
      var consecutiveLosses = 0;
      var lastPrice = 0.0;
      var ema50 = 0.0;
      var ema200 = 0.0;
      var rsi = 0.0;
    };
    trades.clear();
    nextTradeId.clear();
    addLog("warning", "Bot reset: all trades cleared, capital restored to $" # config.capital.toText());
  };

  // Manual tick
  public shared ({ caller }) func manualTick() : async Text {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can manually tick");
    };
    if (not botState.isRunning) {
      addLog("warning", "Manual tick attempted while bot is stopped");
      Runtime.trap("Bot is not running");
    };
    addLog("info", "Manual tick triggered");
    await performStrategyEvaluation();
    "Manual tick completed";
  };

  // Strategy evaluation
  func performStrategyEvaluation() : async () {
    try {
      let url = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=210";
      addLog("info", "Fetching market data from Binance API");
      let candleData = await OutCall.httpGetRequest(url, [], transform);
      let _ = candleData;
      addLog("info", "Strategy evaluation completed successfully");
    } catch e {
      let errMsg = e.message();
      addLog("error", "Strategy evaluation failed: " # errMsg);
    };
  };

  // Close trade
  public shared ({ caller }) func closeTrade(id : Nat, profit : Float, closeReason : Text) : async (Int, Float) {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can close trades");
    };
    switch (trades.get(id)) {
      case (null) {
        addLog("error", "Attempted to close non-existent trade #" # id.toText());
        Runtime.trap("Trade does not exist.");
      };
      case (?trade) {
        let closeTime = Time.now();
        let closedTrade : Trade = {
          id = trade.id;
          pair = trade.pair;
          entryPrice = trade.entryPrice;
          exitPrice = ?profit;
          size = trade.size;
          status = "closed";
          openTime = trade.openTime;
          closeTime = ?closeTime;
          pnl = ?profit;
          closeReason = ?closeReason;
        };
        trades.add(id, closedTrade);
        botState.totalPnL := botState.totalPnL + profit;
        botState.openTradesCount := if (botState.openTradesCount > 0) { botState.openTradesCount - 1 } else { 0 };
        let pnlStr = if (profit >= 0.0) { "+$" # profit.toText() } else { "-$" # (-profit).toText() };
        addLog(
          if (profit >= 0.0) { "info" } else { "warning" },
          "Trade #" # id.toText() # " closed (" # closeReason # "), PnL: " # pnlStr
        );
        (closeTime, profit);
      };
    };
  };
};
