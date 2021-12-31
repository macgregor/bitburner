import * as lib from "lib.js";

class SingularityContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, args=null){
      super(ns, args)
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

class InstallBackdoorAction extends lib.Action{
  constructor(){
      super("Install backdoors")
      this.servers = [
        "run4theh111z",
        "I.I.I.I",
        "avmnite-02h",
        "CSEC"
      ]
  }

  async priority(context){
    return 10
  }

  async isActionable(context){
    const servers = context.network.vulnerableServers()
    await this.logger.debug(lib.StringFormatter.sprintf("isActionable: %s", servers > 0), servers)
    return servers.length > 0
  }

  async performAction(context){
    await this.logger.debug("performAction")
  }
}

/** @param {NS} ns **/
export async function main(ns) {
  const args = {
    logLevel: "info",
    logPort: 1,
    cashReserve: 10000000,
    homeRamReserve: 32,
  }
	const context = new SingularityContext(ns, args)
  const bot = new lib.ModuleEngine(context)
  bot.setActions([])

	await bot.main()
}
