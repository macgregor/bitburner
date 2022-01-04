import * as lib from "lib.js";

class SleeveContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, configFilename){
      super(ns, configFilename)
  }

  playerInitializer(){
    return async (playerInfo, context) => {
      return {
        info: context.ns.getPlayer(),
        singularity: {
          ownedSourceFiles: context.ns.getOwnedSourceFiles(),
          focused: context.ns.isFocused()
        },
        sleeve: {
        }
      }
    }
  }
}

class SleeveAction extends lib.Action {
  constructor(name, staticPriority){
      super(name, staticPriority)
      this.maxSleeves = 8
      this.numSleeves = this.maxSleeves
  }

  async isActionable(context){
    return (context.playerInfo.currentBitnode() == 10 || context.playerInfo.hasSourceFile(10, 1)) &&
      !context.playerInfo.focused() &&
  }

  // count sleeves without costing an extra 4 gigs from ns.sleeve.getNumSleeves()
  numSleeves(){
    var i = 0
    try{
      while(i < this.maxSleeves){
        this.context.ns.sleeve.getTask(i)
        i++
      }
    } catch(err){}
    return i;
  }

  tasks(){
    const t = []
    for(var i = 0; i < this.numSleeves(); i++){
      t.push(this.context.ns.sleeve.getTask(i))
    }
    return t
  }


}


class ManageSleevesAction extends SleeveAction{
  constructor(staticPriority){
      super("Accept faction invites", staticPriority)
  }

  async isActionable(context){
    return (context.playerInfo.currentBitnode() == 10 || context.playerInfo.hasSourceFile(10, 1)) &&
      !context.playerInfo.focused() &&
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
