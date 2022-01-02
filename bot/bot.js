import * as lib from "lib.js";

class BotContext extends lib.Context {
  /** @param {NS} ns **/
  constructor(ns, configFilename){
      super(ns, configFilename)
  }

  playerInitializer(){
    return async (playerInfo, context) => {
      await playerInfo.logger.trace("Initializing player data.")
      return {
        info: context.ns.getPlayer(),
        karma: context.ns.heart.break(),
        //hackingMultipliers: this.ns.getHackingMultipliers(),
        //bitnodeMultipliers: this.ns.getBitNodeMultipliers(),
        hackingMultipliers: {},
        bitnodeMultipliers: {},
      }
    }
  }

  serverInitializer(){
    return async (server, context) => {
      await server.logger.trace("Initializing host data: " + server.hostname)
      return {
        info: context.ns.getServer(server.hostname),
        neighbors: context.ns.scan(server.hostname),
        files: context.ns.ls(server.hostname),
        processes: context.ns.ps(server.hostname)
      }
    }
  }
}

class ModuleLauncher extends lib.Module{
  constructor(script){
      super(script)
  }

  async costWrapper(context, script){
    return context.ns.getScriptRam(script)
  }

  async execWrapper(context, script, host, threads, args){
    if(!host.hasFile(script)){
      await context.ns.scp(script, "home", host.hostname)
      host.refresh()
    }
    return context.ns.exec(script, host.hostname, threads, ...args)
  }

  async killWrapper(context, script, host, args){
    return context.ns.kill(script, host.hostname, ...args)
  }
}

function loadModules(context){
  const modules = []
  const files = context.ns.ls("home")
  for(const f of files){
    if(f.startsWith("module_")){
      modules.push(new ModuleLauncher(f))
    }
  }
  return modules
}

/** @param {NS} ns **/
export async function main(ns) {
	const context = new BotContext(ns, "config.txt")
  const bot = new lib.BotEngine(context)
  bot.setModules(loadModules(context))
	await bot.daemon()

}
