import * as lib from "lib.js";

class HackingContext extends lib.ModuleContext {
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
        //hackingMultipliers: this.ns.getHackingMultipliers(),
        //bitnodeMultipliers: this.ns.getBitNodeMultipliers(),
        hackingMultipliers: {},
        bitnodeMultipliers: {},
        hacknetInfo: {
          numHashes: context.ns.hacknet.numHashes(),
          hashCapacity: context.ns.hacknet.hashCapacity(),
        }
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

class ServerBreachAction extends lib.Action{
  constructor(staticPriority){
      super("Breach vulnerable servers", staticPriority)
  }

  async isActionable(context){
    return context.network.vulnerableServers().length > 0
  }

  async performAction(context){
    const taskResults = []
    for(const s of context.network.vulnerableServers()){
      if(context.playerInfo.canCrackSsh()){
        context.ns.brutessh(s.hostname)
      }
      if(context.playerInfo.canCrackSmtp()){
        context.ns.relaysmtp(s.hostname)
      }
      if(context.playerInfo.canCrackSql()){
        context.ns.sqlinject(s.hostname)
      }
      if(context.playerInfo.canCrackFtp()){
        context.ns.ftpcrack(s.hostname)
      }
      if(context.playerInfo.canCrackHttp()){
        context.ns.httpworm(s.hostname)
      }
      context.ns.nuke(s.hostname)
      await s.refreshData()
      taskResults.push(this.taskResults(s.hostname, s.haveRootAccess()))
    }
    return this.actionResults(...taskResults)
  }
}

class BotnetAttack extends lib.Action{
  constructor(name, staticPriority, script, scriptBody){
      super(name, staticPriority)
      this.script = script
      this.scriptBody = scriptBody
  }

  async isActionable(context){
    const threadsAvailable = await this.threadsAvailable(context)
    const targets = await this.targets(context)
    return threadsAvailable > 0 && targets.length > 0
  }

  async performAction(context){
    const results = {success: true, details: []}
    const taskResults = []
    const costPerThread = this.cost(context)
    const botnet = context.network.botnetServers()
    const targets = await this.targets(context)

    if(!context.network.server("home").hasFile(this.script)){
      await context.ns.write(this.script, this.scriptBody, "w")
    }

    for(const target of targets){
      var threadsNeeded = await this.threadsNeeded(context, target) - this.threadsRunning(context, target)
      var bestHost = this.determineBestHost(botnet, context.homeRamReserve, threadsNeeded, costPerThread)
      var threadsStarted = 0
      while(bestHost && bestHost.server && bestHost.threads > 0 && threadsStarted < threadsNeeded){
        var attackDetails = {
          script: this.script,
          target: target.hostname,
          host: bestHost.server.hostname,
          threads: bestHost.threads,
        }
        var attackError = null
        var success = false
        try{
          if(!bestHost.server.hasFile(this.script)){
            await context.ns.scp(this.script, "home", bestHost.server.hostname)
            await bestHost.server.refreshData()
          }
          if(context.ns.exec(this.script, bestHost.server.hostname, bestHost.threads, target.hostname)){
            success = true
            threadsStarted += bestHost.threads
            await bestHost.server.refreshData()
            threadsNeeded = await this.threadsNeeded(context, target) - this.threadsRunning(context, target)
            bestHost = this.determineBestHost(botnet, context.homeRamReserve, threadsNeeded, costPerThread)
          } else{
            attackError = "exec FAILED"
            break
          }
        } catch(error){
          attackError = error
        }
        taskResults.push(this.taskResults(this.script + " targeting " + target.hostname, success, attackDetails, attackError))
      }
    }
    return this.actionResults(...taskResults)
  }

  cost(context){
    return context.ns.getScriptRam(this.script)
  }

  threadsRunning(context, target){
    return context.network.botnetServers()
      .flatMap(b => b.procSearch(this.script, target.hostname))
      .map(proc => proc.threads)
      .reduce((sum, t) => sum + t, 0)
  }

  async targets(context){
    const targets = context.network.potentialTargetServers(true)
		const alreadyTargeted = context.network.botnetServers()
      .flatMap(b => b.procSearch())
      .filter(proc => proc.args && proc.args.length > 0 && targets.includes(proc.args[0]))
      .map(proc => proc.args[0])
    this.logger.debug("Already targeted", alreadyTargeted)

    return context.network.potentialTargetServers()
      .filter(s => !alreadyTargeted.includes(s.hostname))
  }

  async threadsAvailable(context){
    const botnet = context.network.botnetServers()
    const threads = Math.floor((lib.Network.maxRam(botnet) - lib.Network.ramUsed(botnet) - context.homeRamReserve) / this.cost(context))
    this.logger.debug("Threds available: " + threads)
    return threads
  }

  determineBestHost(botnet, homeRamReserve, threadsNeeded, costPerThread){
    var bestMatch = { server: null, threads: 0}
    for(const server of botnet){
      var availableThreads = Math.floor(server.availableRam()/costPerThread)
      if(server.isHome()){
        availableThreads = Math.floor((server.availableRam()-homeRamReserve)/costPerThread)
      }
      if(availableThreads > 0){
        if((threadsNeeded - availableThreads) < (threadsNeeded - bestMatch.threads)){
          bestMatch = { server: server, threads: availableThreads}
        }
      }
    }
    return bestMatch
  }

  async threadsNeeded(context, target){
    throw new TypeError("You need to implement this yourself");
  }
}

class WeakenAttack extends BotnetAttack {
  static SCRIPT_BODY = `
export async function main(ns) {
  await ns.weaken(ns.args[0]);
}`
  constructor(staticPriority){
      super("Weaken security level on target servers", staticPriority, "_weaken.js", WeakenAttack.SCRIPT_BODY)
  }

  async targets(context){
    const targets = await super.targets(context)
    return targets.filter(t => t.serverSecurityLevel() > t.minSecurityLevel())
  }

  async threadsNeeded(context, target){
    const coreBonus = 1 + (target.cpuCores() - 1) / 16;
    const threads = (target.serverSecurityLevel() - target.minSecurityLevel()) / (0.05 * coreBonus)
    return Math.ceil(threads)
  }
}

class GrowAttack extends BotnetAttack {
  static SCRIPT_BODY = `
export async function main(ns) {
  await ns.grow(ns.args[0]);
}`
  constructor(staticPriority){
      super("Grow available money on target servers", staticPriority, "_grow.js", GrowAttack.SCRIPT_BODY)
  }

  async targets(context){
    const targets = await super.targets(context)
    return targets.filter(t => t.moneyAvailable() < t.moneyMax() && t.serverSecurityLevel() == t.minSecurityLevel())
  }

  async threadsNeeded(context, target){
    const growthAmount = target.moneyMax() / (target.moneyAvailable()+1)
    const threads = context.ns.growthAnalyze(target.hostname, growthAmount, target.cpuCores())
    return Math.ceil(threads)
  }
}

class HackAttack extends BotnetAttack {
  static SCRIPT_BODY = `
export async function main(ns) {
  await ns.hack(ns.args[0]);
}`

  constructor(staticPriority){
      super("Hack target servers to steal money", staticPriority, "_hack.js", HackAttack.SCRIPT_BODY)
  }

  async targets(context){
    const targets = await super.targets(context)
    return targets.filter(t => t.moneyAvailable() == t.moneyMax() && t.serverSecurityLevel() == t.minSecurityLevel())
  }

  async threadsNeeded(context, target){
    const botnet = context.network.botnetServers()
    const hackThreadsAvailable = ((lib.Network.maxRam(botnet) - lib.Network.ramUsed(botnet) - context.homeRamReserve) / this.cost(context)) * 0.95
    const targets = await this.targets(context)
    const hackThreadsPerTarget = Math.floor(hackThreadsAvailable / targets.length)
    return hackThreadsPerTarget
  }
}

/** @param {NS} ns **/
export async function main(ns) {
	const context = new HackingContext(ns, "config.txt")
  const bot = new lib.ModuleEngine(context)
  bot.setActions([
    new ServerBreachAction(0),
    new WeakenAttack(1),
    new GrowAttack(1),
    new HackAttack(1),
	])

	await bot.main()

}
