import * as lib from "lib.js";

class StockTraderContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, args){
      super(ns, args)
  }

  playerInitializer(){
    return async (playerInfo, context) => {
      return {
        info: context.ns.getPlayer(),
      }
    }
  }
}

class StockTraderAction extends lib.Action {
  constructor(name, priority){
      super(name)
      this._priority = priority
  }

  async priority(context){
    return this._priority
  }

  async isActionable(context){
    return context.playerInfo.hasStockMarketApiAccess()
  }

  getAllStocks() {
      // make a lookup table of all stocks and all their properties
      const stockSymbols = this.context.ns.stock.getSymbols();
      const stocks = {};
      for (const symbol of stockSymbols) {

          const pos = this.context.ns.stock.getPosition(symbol);
          const stock = {
              symbol: symbol,
              forecast: this.context.ns.stock.getForecast(symbol),
              volatility: this.context.ns.stock.getVolatility(symbol),
              askPrice: this.context.ns.stock.getAskPrice(symbol),
              bidPrice: this.context.ns.stock.getBidPrice(symbol),
              maxShares: this.context.ns.stock.getMaxShares(symbol),
              shares: pos[0],
              sharesAvgPrice: pos[1],
              sharesShort: pos[2],
              sharesAvgPriceShort: pos[3]
          };
          stock.summary = `${stock.symbol}: ${stock.forecast.toFixed(3)} ± ${stock.volatility.toFixed(3)}`;
          stocks[symbol] = stock;
      }
      return Object.values(stocks);
  }

  getPortfolioValue() {
      return this.getAllStocks()
        .map(stock => stock.bidPrice * stock.shares - stock.askPrice * stock.sharesShort)
        .reduce((sum, v) => sum + v, 0)
  }

  playerNetworth(){
    const portfolioValue = this.getPortfolioValue();
    const cashValue = this.context.playerInfo.money();
    const totalValue = portfolioValue + cashValue;
    this.logger.info(`Net worth: ${lib.StringFormatter.nFormat("$0.000a", totalValue)} = ${lib.StringFormatter.nFormat("$0.0a", portfolioValue)} stocks + ${lib.StringFormatter.nFormat("$0.0a", cashValue)} cash`);
    return totalValue
  }
}

class SellStocksAction extends StockTraderAction {
  // select stocks with at most threshold % chance to increase each cycle
  constructor(priority, sellThreshold=0.48){
    super("Sell stocks", priority)
    this.sellThreshold = sellThreshold
  }

  async isActionable(context){
    const hasApiAccess = await super.isActionable(context)
    const sellableStocks = this.getSellableStocks()
    return hasApiAccess && sellableStocks.length > 0
  }

  async performAction(context){
    const results = {success: true, details: []}
    const sellableStocks = this.getSellableStocks()
    if(sellableStocks.length == 0){
      results.details = "No stocks available to sell."
    }
    for(const stock of sellableStocks){
      const salePrice = context.ns.stock.sell(stock.symbol, stock.shares);
      if (salePrice != 0) {
          context.playerInfo.refreshData()
          const saleTotal = salePrice * stock.shares;
          const saleCost = stock.sharesAvgPrice * stock.shares;
          const saleProfit = saleTotal - saleCost;
          stock.shares = 0;

          results.details.push(`Sold ${stock.summary} stock for ${lib.StringFormatter.nFormat("$0.0a", saleProfit)} profit`)
      }
    }
    this.playerNetworth()
    return results
  }

  getSellableStocks() {
      return this.getAllStocks()
        .filter(stock => stock.shares > 0)
        .filter(stock => stock.forecast - stock.volatility < this.sellThreshold)
  }
}

class BuyStocksAction extends StockTraderAction {

  static TXN_COST = 100000

  // select stocks with at least threshold % chance to increase each cycle
  constructor(priority, buyThreshold=0.55, maxTransactions=4){
    super("Buy stocks", priority)
    this.buyThreshold = buyThreshold
    this.maxTransactions = maxTransactions
  }

  async isActionable(context){
    const hasApiAccess = await super.isActionable(context)
    const buyableStocks = this.getBuyableStocks()
    const canAffordToInvest = context.playerInfo.moneySpendable() > BuyStocksAction.TXN_COST * Math.min(buyableStocks.length, this.maxTransactions) * 10
    return hasApiAccess && buyableStocks.length > 0 && canAffordToInvest
  }

  async performAction(context){
    const results = {success: true, details: []}
    var transactions = 0;
    const buyableStocks = this.getBuyableStocks()
    if(buyableStocks.length == 0){
      results.details = "No stocks available to buy."
    }
    for(const stock of buyableStocks){
      const moneyRemaining = context.playerInfo.moneySpendable();
      if (transactions >= this.maxTransactions) {
          break;
      }

      // spend up to half the money available on the highest rated stock
      // (the following stock will buy half as much)
      const moneyThisStock = moneyRemaining/2 - BuyStocksAction.TXN_COST;
      var numShares = Math.min(moneyThisStock / stock.askPrice, stock.maxShares - stock.shares - stock.sharesShort);
      const boughtPrice = context.ns.stock.buy(stock.symbol, numShares);
      if (boughtPrice != 0) {
          context.playerInfo.refreshData()
          const boughtTotal = boughtPrice * numShares;
          transactions += 1;
          stock.shares += numShares;
          results.details.push(`Bought ${lib.StringFormatter.nFormat("$0.0a", boughtTotal)} of ${stock.summary}`);
      }
    }
    this.playerNetworth()
    return results
  }

  getBuyableStocks(){
      const stocks = this.getAllStocks()
        .filter(stock => stock.maxShares - stock.shares - stock.sharesShort > 0)
        .filter(stock => stock.forecast - stock.volatility > this.buyThreshold)
      stocks.sort((a,b)=>{
          return b.forecast - a.forecast; // descending
      });
      return stocks
  }
}

/** @param {NS} ns **/
export async function main(ns) {
  const args = {
    logLevel: "info",
  }
	const context = new StockTraderContext(ns, args)
  const bot = new lib.ModuleEngine(context)
  bot.setActions([
    new SellStocksAction(0),
    new BuyStocksAction(0),
	])

	await bot.main()

}
