  import * as lib from "lib.js";

class BackdoorContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, configFilename){
      super(ns, configFilename)
  }

  playerInitializer(){
    return async (playerInfo, context) => {
      return {
        info: context.ns.getPlayer(),
        karma: context.ns.heart.break(),
        singularity: {
          ownedSourceFiles: context.ns.getOwnedSourceFiles(),
          focused: context.ns.isFocused()
        }
      }
    }
  }

  serverInitializer(){
    return async (server, context) => {
      return {
        info: context.ns.getServer(server.hostname),
        neighbors: context.ns.scan(server.hostname),
      }
    }
  }
}

class InstallBackdoorAction extends lib.Action{
  constructor(staticPriority){
      super("Install backdoors", staticPriority)
      this.servers = [
        "run4theh111z",
        "I.I.I.I",
        "avmnite-02h",
        "CSEC"
      ]
  }

  connect(targetServer){
    if(this.context.ns.getCurrentServer() == targetServer.hostname){
      return true
    }
    for(const s of targetServer.pathFromHome){
      if(this.context.ns.getCurrentServer() != s && !this.context.ns.connect(s)){
        return false
      }
    }
    return this.context.ns.getCurrentServer() == targetServer.hostname
  }

  backdoorServers(){
    return this.servers
      .map(s => this.context.network.server(s))
      .filter(s => s.haveRootAccess() && !s.backdoorInstalled())
  }

  async isActionable(context){
    const servers = this.backdoorServers()
    return context.playerInfo.hasSourceFile(4, 1) &&
      !context.playerInfo.focused() &&
      servers.length > 0
  }

  async performAction(context){
    const servers = this.backdoorServers()
    var taskResults = []
    if(servers.length > 0){
      try{
        for(const server of this.backdoorServers()){
          if(!this.connect(server)){
            taskResults.push(this.taskResults(server.hostname, false, null, "FAILED to connect to server"))
          } else{
            await context.ns.installBackdoor()
            await server.refreshData()
            var maybeError = server.backdoorInstalled() ? null : "FAILED to install backdoor"
            taskResults.push(this.taskResults(server.hostname, server.backdoorInstalled(), null, maybeError))
          }
        }
      } finally{
        this.connect(context.network.server("home"))
      }
    }
    return this.actionResults(...taskResults)
  }
}


/** @param {NS} ns **/
export async function main(ns) {
	const context = new BackdoorContext(ns, "config.txt")
  const bot = new lib.ModuleEngine(context)
  bot.setActions([
    new InstallBackdoorAction(0),
  ])

	await bot.main()
}
