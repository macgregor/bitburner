import * as lib from "lib.js";

class Faction extends lib.Base {

  constructor(name, requirements){
    super()
    this.name = name
    this.requirements = requirements
  }
}

class FactionContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, configFilename){
      super(ns, configFilename)
  }

  playerInitializer(){
    return async (playerInfo, context) => {
      return {
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
        neighbors: context.ns.scan(server.hostname),
      }
    }
  }
}

class JoinFactionsAction extends lib.Action{
  constructor(staticPriority){
      super("Accept faction invites", staticPriority)
  }

  joinableFactions(){
    return context.ns.checkFactionInvitations()
      .filter(f => !this.context.factionJoinBlacklist().includes(f))
  }

  async isActionable(context){
    return context.playerInfo.hasSourceFile(4, 2) &&
      !context.playerInfo.focused() &&
      this.joinableFactions().length > 0
  }

  async performAction(context){
    const results = {success: true, action: "join factions", details: []}
    const taskResults = []
    for(const f of this.joinableFactions()){
      taskResults.push(this.taskResults(f, context.ns.joinFaction(f)))
    }
    return this.actionResults(...taskResults)
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
