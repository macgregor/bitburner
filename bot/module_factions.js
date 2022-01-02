import * as lib from "lib.js";

class FactionContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, configFilename){
      super(ns, configFilename)
  }

  playerInitializer(){
    return async (playerInfo, context) => {
      return {,
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
      }
    }
  }
}


class JoinFactionsAction extends lib.Action{
  constructor(staticPriority){
      super("Accept faction invites", staticPriority)
  }

  async isActionable(context){
    return context.playerInfo.hasSourceFile(4, 2) && context.ns.checkFactionInvitations().length > 0
  }

  async performAction(context){
    const results = {success: true, action: "join factions", details: []}
    for(const f of context.ns.checkFactionInvitations()){
      var r = {faction: f, status: "SUCCESS"}
      if(!context.ns.joinFaction(f)){
        r.status = "FAILED"
      }
      results.details.push(r)
    }
    return results
  }
}


/** @param {NS} ns **/
export async function main(ns) {
  const context = new FactionContext(ns, "config.txt")
  const bot = new lib.ModuleEngine(context)
  bot.setActions([
    new JoinFactionsAction(0)
  ])

  await bot.main()
}
