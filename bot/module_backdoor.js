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
        //files: context.ns.ls("home"),
        //hackingMultipliers: this.ns.getHackingMultipliers(),
        //bitnodeMultipliers: this.ns.getBitNodeMultipliers(),
        hackingMultipliers: {},
        bitnodeMultipliers: {},
        singularity: {
          ownedSourceFiles: context.ns.getOwnedSourceFiles(),
          isBusy: context.ns.isBusy(),
          isFocused: context.ns.isFocused()
        }
      }
    }
  }

  serverInitializer(){
    return async (server, context) => {
      return {
        info: context.ns.getServer(server.hostname),
        neighbors: context.ns.scan(server.hostname),
        //files: context.ns.ls(server.hostname),
        //processes: context.ns.ps(server.hostname)
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
    return context.playerInfo.hasSourceFile(4, 1) && servers.length > 0
  }

  async performAction(context){
    const results = {success: true, action: "install backdoor", details: []}
    const servers = this.backdoorServers()
    if(servers.length > 0){
      try{
        for(const server of this.backdoorServers()){
          const r = {hostname: server.hostname, status: "FAILED"}
          if(!this.connect(server)){
            r.status = "FAILED to connect"
            results.success = false
          } else{
            await context.ns.installBackdoor()
            server.refreshData()
            r.status = server.backdoorInstalled() ? "SUCCESS" : "FAILED to install backdoor"
            results.success = false
          }
          results.details.push(r)
        }
      } finally{
        this.connect(context.network.server("home"))
      }
    }
    return results
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
