import * as lib from "lib.js";

class PurchaseServersContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, configFilename){
      super(ns, configFilename)
  }

  playerInitializer(){
    return async (playerInfo, context) => {
      return {
        info: context.ns.getPlayer(),
        karma: context.ns.heart.break(),
        files: context.ns.ls("home"),
        hackingMultipliers: {},
        bitnodeMultipliers: {},
        hacknetInfo: {}
      }
    }
  }

  serverInitializer(){
    return async (server, context) => {
      return {
        info: context.ns.getServer(server.hostname),
        neighbors: context.ns.scan(server.hostname),
        files: context.ns.ls(server.hostname),
        processes: context.ns.ps(server.hostname)
      }
    }
  }
}

class ServerPurchaseAction extends lib.Action {
  constructor(name, priority){
    super(name)
    this._priority = priority
    this.maxPurchaseRam = this.context.ns.getPurchasedServerMaxRam()
    this.purchasedServerLimit = this.context.ns.getPurchasedServerLimit()
    this.serverSizes = this.serverSizes()
  }

  async priority(context){
    return this._priority
  }

  serverSizes(){
      var i = 3 //dont spend money on 2/4 gig servers
      var ram = Math.pow(2, i)
      var ret = []
      while(ram <= this.maxPurchaseRam){
          var cost = this.context.ns.getPurchasedServerCost(ram)
          ret.push({ram: ram, cost: cost})
          i += 1
          ram = Math.pow(2, i)
      }
      return ret
  }

  serverSpaceAvailable(){
    return this.purchasedServerLimit - this.context.network.purchasedServers().length
  }

  status(){
    var maxAffordableUpgrade = null
    const affordableUpgrades = this.serverSizes.filter(s => this.context.playerInfo.moneySpendable() > s.cost)
    if(affordableUpgrades.length > 0){
      //
      maxAffordableUpgrade = affordableUpgrades[affordableUpgrades.length-1]
    }

    const maxedServers = this.context.network.purchasedServers()
      .filter(s => s.maxRam() >= this.maxPurchaseRam)
      .map(s => s.hostname)

    const upgrades = this.context.network.purchasedServers()
      .filter(s => s.maxRam() < this.maxPurchaseRam)
      .map(s => {
        // how many levels the upgrade provides, e.g. 2GB => 8GB == 2
        var upgradeJump = 0
        if(maxAffordableUpgrade != null && s.maxRam() < maxAffordableUpgrade.ram){
          upgradeJump = Math.log2(maxAffordableUpgrade.ram) - Math.log2(s.maxRam())
        }

        return {
          hostname: s.hostname,
          ram: s.maxRam(),
          nextUpgrade: maxAffordableUpgrade,
          upgradeJump: upgradeJump
        }
      })
      .filter(u => u.upgradeJump >= this.context.minPurchaseServerUpgradeLevels)

      // purchase largest upgrade increase first to minimize overall cost
      // (since you dont get money back when you delete a server)
      upgrades.sort((a, b) => b.upgradeJump - a.upgradeJump)

      const markedForUpgrade = this.context.network.purchasedServers()
        .filter(s => s.isMarkedForUpgrade())
        .map(s => s.hostname)

      return {
        serverSpaceAvailable: this.serverSpaceAvailable(),
        maxedServers: maxedServers,
        maxAffordableUpgrade: maxAffordableUpgrade,
        markedForUpgrade: markedForUpgrade,
        upgrades: upgrades
      }
  }
}

class MarkServerForUpgradeAction extends ServerPurchaseAction {
  constructor(priority){
    super("Mark servers for future upgrade", priority)
  }

  async isActionable(context){
    const status = this.status()
    return context.spendMoney &&
      status.serverSpaceAvailable == 0 &&
      status.markedForUpgrade.length == 0 &&
      status.maxAffordableUpgrade != null &&
      status.upgrades.length > 0 &&
      status.maxedServers.length < this.purchasedServerLimit
  }

  async performAction(context){
    const status = this.status()
    const toUpgrade = status.upgrades[0]
    const success = await context.ns.scp(context.fileLock, "home", toUpgrade.hostname)
    return this.actionResults(this.taskResults(toUpgrade.hostname, success, toUpgrade))
  }
}

class RemoveServerAction extends ServerPurchaseAction {
  constructor(priority){
    super("Remove marked servers for upgrade", priority)
  }

  async isActionable(context){
    const toUpgrade = context.network.purchasedServers()
      .filter(s => s.isMarkedForUpgrade())
      .filter(s => s.procSearch().length == 0)
    return context.spendMoney && toUpgrade.length > 0
  }

  async performAction(context){
    const taskResults = context.network.purchasedServers()
      .filter(s => s.isMarkedForUpgrade())
      .filter(s => s.procSearch().length == 0)
      .map(s => this.taskResults(s.hostname, this.context.ns.deleteServer(s.hostname), {ram: s.maxRam()}))

    return this.actionResults(...taskResults)
  }
}

class PurchaseServerAction extends ServerPurchaseAction {
  constructor(priority){
    super("Purchase new servers", priority)
  }

  async isActionable(context){
    const status = this.status()
    //await this.logger.debug("", status)
    return context.spendMoney &&
      status.serverSpaceAvailable > 0 &&
      status.maxAffordableUpgrade != null
  }

  async performAction(context){
    const status = this.status()
    const hostname = this.context.ns.purchaseServer(context.purchaseServerHostname, status.maxAffordableUpgrade.ram)
    const taskResults = this.taskResults(context.purchaseServerHostname, hostname.startsWith(context.purchaseServerHostname), status.maxAffordableUpgrade)
    return this.actionResults(taskResults)
  }
}

/** @param {NS} ns **/
export async function main(ns) {
	const context = new PurchaseServersContext(ns, "config.txt")
  const bot = new lib.ModuleEngine(context)
  if(!ns.fileExists(context.fileLock)){
    await ns.write(context.fileLock, 0, "w")
  }
  bot.setActions([
    new MarkServerForUpgradeAction(10),
    new RemoveServerAction(20),
    new PurchaseServerAction(30),
	])

	await bot.main()
}
