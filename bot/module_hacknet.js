import * as lib from "lib.js";

class HacknetContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, configFilename){
      super(ns, configFilename)
  }

  playerInitializer(){
    return async (playerInfo, context) => {
      return {
        hacknetInfo: {
          hashCapacity: context.ns.hacknet.hashCapacity(),
          numHashes: context.ns.hacknet.numHashes(),
        }
      }
    }
  }
}

class HacknetAction extends lib.Action {

  constructor(name, staticPriority){
    super(name, staticPriority)
  }

  static HASH_UPGRADES = {
    money: "Sell for Money",
    corpFunds: "Sell for Corporation Funds",
    reduceMinSec: "Reduce Minimum Security",
    increaseMaxMoney: "Increase Maximum Money",
    improveStudying: "Improve Studying",
    improveGym: "Improve Gym Training",
    corpResearch: "Exchange for Corporation Research",
    bladeburnerRank: "Exchange for Bladeburner Rank",
    bladeburnerSp: "Exchange for Bladeburner SP",
    codingContract: "Generate Coding Contract",
  }


}

class SpendHashesAction extends HacknetAction{
  constructor(staticPriority){
      super("Spend Hacknet hashes", staticPriority)
  }

  hashCost(upgradeName){
    return this.context.ns.hacknet.hashCost(upgradeName)
  }

  async spendHashes(upgradeName, upgradeTarget=null){
    const success = this.context.ns.hacknet.spendHashes(upgradeName, upgradeTarget)
    await this.context.playerInfo.refreshData()
    return success
  }

  affordableUpgrades(){
    return Object.values(HacknetAction.HASH_UPGRADES)
      .filter(u => this.hashCost(u) >= this.context.playerInfo.hacknetNumHashes())
  }

  async spendAllOn(upgrade){
    const taskResults = []
    var cost = this.hashCost(upgrade)
    while(this.context.playerInfo.hacknetNumHashes() >= cost){
      var success = await this.spendHashes(upgrade)
      taskResults.push(this.taskResults(upgrade, success))
      if(!success){
        break
      }
      cost = this.hashCost(upgrade)
    }
    return taskResults
  }

  async isActionable(context){
    this.logger.debug(this.affordableUpgrades())
    return this.affordableUpgrades().length > 0
  }

  async performAction(context){
    var taskResults = []

    // save up for coding contracts if we have the capacity
    var codingContractCost = this.hashCost(HacknetAction.HASH_UPGRADES.codingContract)
    if(context.playerInfo.hacknetHashCapacity() >= codingContractCost){
      taskResults = await this.spendAllOn(HacknetAction.HASH_UPGRADES.codingContract)
    }

    // redeem hashes for money once we cant afford coding contracts
    codingContractCost = this.hashCost(HacknetAction.HASH_UPGRADES.codingContract)
    if(context.playerInfo.hacknetHashCapacity() < codingContractCost){
      taskResults = taskResults.concat(await this.spendAllOn(HacknetAction.HASH_UPGRADES.money))
    }
    return this.actionResults(...taskResults)
  }
}


/** @param {NS} ns **/
export async function main(ns) {
  const context = new HacknetContext(ns, "config.txt")
  const bot = new lib.ModuleEngine(context)
  bot.setActions([
    new SpendHashesAction(0)
  ])

  await bot.main()
}
