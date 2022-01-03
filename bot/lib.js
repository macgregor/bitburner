/**
 * This library should only contain code mostly pure Javascript that
 * does not use addition RAM so that critical functionality can be
 * reused in any scripts with minimal overhead. If the RAM cost goes
 * above 1.6 GB, you either used a netscript function which costs RAM
 * or you named a function/method the same as a netscript function which
 * costs RAM
 *
 * Reserved function/method names:
 *  - kill
 *  - rm
 *  - run
 *  - ps
 *  - isRunning
 *  - get
 */

 const LOG_LEVELS = {
   "error": 0,
   "warn": 1,
   "info": 2,
   "debug": 3,
   "trace": 4
 }

 function orElse(obj, key, defaultValue){
   if(obj && obj.hasOwnProperty(key)){
     return obj[key]
   }
   return defaultValue
 }

 export class LogEmitters {
   static async PortLogEmitter(script, name, level, msg, data=null){
    const context = Context.instance()

    level = level ? level.toLowerCase() : level
    if(!LOG_LEVELS.hasOwnProperty(level)){
      level = "info"
    }

    if (data && data.stack && data.message) {
      // it's an error, probably
      data = {
        message: data.message,
        stack: data.stack,
      }
    }

    var logMsg = {
      script: script,
      name: name,
      time: new Date().toUTCString(),
      level: level,
      msg: msg,
      data: data
    }
    logMsg = JSON.stringify(logMsg, null, 2)

    if(!context){
      console.log(logMsg)
    } else{
      if(LOG_LEVELS[level] <= LOG_LEVELS[context.logLevel(name)]){
        if(!await context.ns.tryWritePort(context.logPort,logMsg)){
          console.log(logMsg)
        }
      }
    }


   }

   static async NativeLogEmitter(script, name, level, msg, data=null){
    const context = Context.instance()
    var time = new Date().toUTCString()

    level = level ? level.toLowerCase() : level
    if(!LOG_LEVELS.hasOwnProperty(level)){
      level = "info"
    }

    var logMsg = StringFormatter.sprintf("[%s] - %s - %s - %s: \n%s", time, level, script, name, msg)

    if (data && data.stack && data.message) {
      // it's an error, probably
      logMsg += "\nError: " + data.message
      logMsg += "\n" + data.stack
    } else if(data){
      logMsg += "\n" + JSON.stringify(data, null, 2)
    }

    if(!context){
      console.log(logMsg)
    } else{
      if(LOG_LEVELS[level] <= LOG_LEVELS[context.logLevel(name)]){
        context.ns.print(logMsg)
      }
    }
   }

   static async ConsoleLogEmitter(script, name, level, msg, data=null){
     const context = Context.instance()
     var time = new Date().toUTCString()
     level = level ? level.toLowerCase() : level
     if(!LOG_LEVELS.hasOwnProperty(level)){
       level = "info"
     }

     var logMsg = StringFormatter.sprintf("[%s] - %s - %s - %s: \n%s", time, level, script, name, msg)
     if (data && data.stack && data.message) {
       // it's an error, probably
       logMsg += "\nError: " + data.message
       logMsg += "\n" + data.stack
     } else if(data){
       logMsg += "\n" + JSON.stringify(data, null, 2)
     }

     if(!context || LOG_LEVELS[level] <= LOG_LEVELS[context.logLevel(name)]){
       console.log(logMsg)
     }
   }

 }

export class Context{

   static _context = null

   static instance(){
     return Context._context
   }

   static initialize(context){
     Context._context = context
   }

   /** @param {NS} ns **/
   constructor(ns, configFilename="config.txt"){
       this.ns = ns
       this.configFilename = configFilename
       this.config = {}
   }

   setPlayerInfo(playerInfo){
     this.playerInfo = playerInfo
     return this
   }

   setNetwork(network){
     this.network = network
     return this
   }

   logEmitter(){
     return LogEmitters.NativeLogEmitter
   }

   loadConfig(){
     this.config = {}
     try{
       const configData = this.ns.read(this.configFilename)
       Logger.getLogger(this).debug(configData)
       this.config = JSON.parse(configData)
       Logger.getLogger(this).debug(JSON.stringify(this.config, null, 2))
     } catch(error){
       Logger.getLogger(this).error("Unable to parse config file", error)
       this.config = {}
     }
   }

   get logPort() { return orElse(this.config, "logPort", 1) }
   get cashReserve() { return orElse(this.config, "cashReserve", 10000000) }
   get homeRamReserve() { return orElse(this.config, "homeRamReserve", 32) }
   get purchaseServerHostname() { return orElse(this.config, "purchaseServerHostname", "pserv") }
   get fileLock() { return orElse(this.config, "fileLock", "_lock.txt") }
   get disabledModules() { return orElse(this.config, "disabledModules", []) }
   get logLevels() { return orElse(this.config, "loggers", {"root": "info"}) }
   get spendMoney(){ return orElse(this.config, "spendMoney", false) }
   get minPurchaseServerUpgradeLevels(){ return orElse(this.config, "minPurchaseServerUpgradeLevels", 2) }

   logLevel(name){
      for(const [logName, level] of Object.entries(this.logLevels)){
        if(logName == name){
          return level
        }
      }
      return this.logLevels.root
   }

   playerInitializer(){
     return PlayerInfo.DEFAULT_INITIALIZER
   }

   serverInitializer(){
     return ServerInfo.DEFAULT_INITIALIZER
   }

   async refreshData(){
       await this.playerInfo.refreshData()
       await this.network.refreshData()
   }
}

export class ModuleContext extends Context{
 /** @param {NS} ns **/
 constructor(ns, configFilename){
     super(ns, configFilename)
 }

 logEmitter(){
   return LogEmitters.PortLogEmitter
 }
}

export class Logger {

 static NOISY_LOGS = [
     "disableLog",
     "ftpcrack", "sqlinject",
     "relaysmtp", "brutessh",
     "httpworm", "nuke",
     "scan", "exec", "sleep",
     "scp", "getPurchasedServerCost",
     "killall", "deleteServer", "purchaseServer",
     "getServerGrowth", "getServerRequiredHackingLevel",
     "getServerUsedRam", "getServerNumPortsRequired",
     "getServerMaxMoney", "getServerMoneyAvailable",
     "getServerMinSecurityLevel", "getServerMaxRam",
     "getServerSecurityLevel"]
 static _LOGGERS = {}
 static _BUFFER = []

 static getLogger(name=null, script=null){
   if(!name){
     name = "lib.root"
   } else if (typeof name != "string" || name.constructor.name != "String"){
     name = "lib."+name.constructor.name
   }

   const context = Context.instance()
   if(!script){
     script = context && context.ns ? context.ns.getScriptName() : ""
   }
   var key = script+name
   if(!Logger._LOGGERS.hasOwnProperty(key)){
     Logger._LOGGERS[key] = new Logger(script, name)
   }
   return Logger._LOGGERS[key]
 }

 static disableNoisyLogs(){
     const context = Context.instance()
     if(context && context.ns){
       Logger.NOISY_LOGS.forEach(l => context.ns.disableLog(l))
     }
 }

 static async emitLogs(){
   const localBuffer = Logger._BUFFER
   Logger._BUFFER = []
   const context = Context.instance()
   const emitter = context && context.logEmitter() ? context.logEmitter() : LogEmitters.ConsoleLogEmitter
   for(const log of localBuffer){
     try{
       await emitter(...log)
     } catch(error){}
   }
 }

 constructor(script, name){
   this.script = script
   this.name = name
 }

 log(level, msg, data=null){
   Logger._BUFFER.push([this.script, this.name, level, msg, data])
 }

 error(msg, data=null){
   this.log("error", msg, data)
 }

 warn(msg, data=null){
   this.log("warn", msg, data)
 }

 info(msg, data=null){
   this.log("info", msg, data)
 }

 debug(msg, data=null){
   this.log("debug", msg, data)
 }

 trace(msg, data=null){
  this.log("trace", msg, data)
 }
}

export class StringFormatter{

  constructor(){}

  /**
   * Wrapper for: https://github.com/danielyxie/bitburner/blob/dev/markdown/bitburner.ns.nformat.md
   *
   * For formatting options see: http://numeraljs.com/#format
   */
  static nFormat(format, n){
    const context = Context.instance()
    if(!context || !context.ns) return false
    return context.ns.nFormat(n, format)
  }

  /**
   * Wrapper for: https://github.com/danielyxie/bitburner/blob/dev/markdown/bitburner.ns.sprintf.md
   *
   * For formatting options see: https://github.com/alexei/sprintf.js#format-specification
   */
  static sprintf(format, ...args){
    const context = Context.instance()
    if(!context || !context.ns) return false
    return context.ns.sprintf(format, ...args)
  }

  /**
   * Wrapper for: https://github.com/danielyxie/bitburner/blob/dev/markdown/bitburner.ns.vsprintf.md
   *
   * For formatting options see: https://github.com/alexei/sprintf.js#format-specification
   */
  static vsprintf(format, args){
    const context = Context.instance()
    if(!context || !context.ns) return false
    return context.ns.vsprintf(format, args)
  }

  /**
   * Wrapper for: https://github.com/danielyxie/bitburner/blob/dev/markdown/bitburner.ns.tformat.md
   */
  static tFormat(milliseconds){
    const context = Context.instance()
    if(!context || !context.ns) return false
    return context.ns.tFormat(milliseconds)
  }
}

export class Base {
  constructor(){}

  get logger(){
    return Logger.getLogger(this)
  }

  get context(){
    return Context.instance()
  }
}

export class NetscriptDataProxy extends Base{
  constructor(dataRefreshFn, defaults={}){
    super()
    this.dataRefreshFn = dataRefreshFn
    this.defaults = defaults
  }

  static async _updateData(obj, data, defaults){
    const logger = Logger.getLogger("lib.NetscriptDataProxy")

    for(const key of Object.keys(defaults)) {
      var oldValue = orElse(obj, key, null)
      var defaultValue = orElse(defaults, key, null)
      var newValue = orElse(data, key, null)
      if(newValue != null && newValue.constructor.name == "Object"){
        oldValue = oldValue != null && oldValue.constructor.name == "Object" ? oldValue : {}
        defaultValue = defaultValue != null && defaultValue.constructor.name == "Object" ? defaultValue : {}
        obj[key] = await NetscriptDataProxy._updateData(oldValue, newValue, defaultValue)
      } else{
        newValue = newValue != null ? newValue : defaultValue
        if(obj[key] != newValue){
          //logger.trace(StringFormatter.sprintf("Data changed: %s, %s => %s", key, obj[key], newValue))
          obj[key] = newValue
        }
      }
    }
    return obj
  }

  async refreshData(){
    this.logger.trace(StringFormatter.sprintf("Refreshing Netscript data [%s]", this.constructor.name))

    const defaultData = JSON.parse(JSON.stringify(this.defaults))
    const refreshedData = await this.dataRefreshFn(this, this.context)
    await NetscriptDataProxy._updateData(this, refreshedData, defaultData)
    this.logger.trace("Updated Data: ", this)
  }
}

export class PlayerInfo extends NetscriptDataProxy{

    static DEFAULTS = (context) => {
      return {
        info: {
          "hacking": 0,
          "hp": 10,
          "max_hp": 10,
          "strength": 1,
          "defense": 1,
          "dexterity": 1,
          "agility": 1,
          "charisma": 1,
          "intelligence": 0,
          "hacking_chance_mult": 1,
          "hacking_speed_mult": 1,
          "hacking_money_mult": 1,
          "hacking_grow_mult": 1,
          "hacking_exp": 0.0,
          "strength_exp": 0.0,
          "defense_exp": 0.0,
          "dexterity_exp": 0.0,
          "agility_exp": 0.0,
          "charisma_exp": 0.0,
          "hacking_mult": 1,
          "strength_mult": 1,
          "defense_mult": 1,
          "dexterity_mult": 1,
          "agility_mult": 1,
          "charisma_mult": 1,
          "hacking_exp_mult": 1,
          "strength_exp_mult": 1,
          "defense_exp_mult": 1,
          "dexterity_exp_mult": 1,
          "agility_exp_mult": 1,
          "charisma_exp_mult": 1,
          "company_rep_mult": 1,
          "faction_rep_mult": 1,
          "numPeopleKilled": 0,
          "money": 0.0,
          "city": "",
          "location": "",
          "companyName": "",
          "crime_money_mult": 1,
          "crime_success_mult": 1,
          "isWorking": false,
          "workType": "",
          "currentWorkFactionName": "",
          "currentWorkFactionDescription": "",
          "workHackExpGainRate": 0.0,
          "workStrExpGainRate": 0,
          "workDefExpGainRate": 0,
          "workDexExpGainRate": 0,
          "workAgiExpGainRate": 0,
          "workChaExpGainRate": 0.0,
          "workRepGainRate": 0.0,
          "workMoneyGainRate": 0.0,
          "workMoneyLossRate": 0,
          "workHackExpGained": 0.0,
          "workStrExpGained": 0,
          "workDefExpGained": 0,
          "workDexExpGained": 0,
          "workAgiExpGained": 0,
          "workChaExpGained": 0.0,
          "workRepGained": 0.0,
          "workMoneyGained": 0.0,
          "createProgramName": "",
          "createProgramReqLvl": 0,
          "className": "",
          "crimeType": "",
          "work_money_mult": 1,
          "hacknet_node_money_mult": 1,
          "hacknet_node_purchase_cost_mult": 1,
          "hacknet_node_ram_cost_mult": 1,
          "hacknet_node_core_cost_mult": 1,
          "hacknet_node_level_cost_mult": 1,
          "hasWseAccount": false,
          "hasTixApiAccess": false,
          "has4SData": false,
          "has4SDataTixApi": false,
          "bladeburner_max_stamina_mult": 1,
          "bladeburner_stamina_gain_mult": 1,
          "bladeburner_analysis_mult": 1,
          "bladeburner_success_chance_mult": 1,
          "bitNodeN": 1,
          "totalPlaytime": 0,
          "playtimeSinceLastAug": 0,
          "playtimeSinceLastBitnode": 0,
          "jobs": {},
          "factions": [],
          "tor": false
        },
        files: [],
        karma: 0,
        hackingMultipliers: {},
        bitnodeMultipliers: {},
        hacknetInfo: {
          hashCapacity: 0,
          maxNumNodes: 0,
          numHashes: 0,
          numNodes: 0,
          purchaseNodeCost: 0,
          studyMult: 1.0,
          trainingMult: 1.0,
        },
        singularity:{
          ownedSourceFiles: [],
          focused: true,
          busy: true
        },
        sleeve: {
          numSleeves: 0
        }
      }
    }
    static DEFAULT_INITIALIZER = (obj, context) => {
      return PlayerInfo.DEFAULTS(context)
    }

    constructor(){
        super(Context.instance().playerInitializer(), PlayerInfo.DEFAULTS(Context.instance()))
    }

    hasStockMarketApiAccess(){
        this.info.has4SData && this.info.has4SDataTixApi && this.info.hasTixApiAccess && this.info.hasWseAccount
    }

    numCrackablePorts(){
        var n = 0
        n += this.canCrackSsh() ? 1 : 0
        n += this.canCrackSmtp() ? 1 : 0
        n += this.canCrackSql() ? 1 : 0
        n += this.canCrackFtp() ? 1 : 0
        n += this.canCrackHttp() ? 1 : 0
        return n
    }

    getHackingMultiplier(key){
        if(this.hackingMultipliers.hasOwnProperty(key)){
            return this.hackingMultipliers[key]
        } else{
            return 1.0
        }
    }

    getBitnodeMultiplier(key){
        if(this.bitnodeMultipliers.hasOwnProperty(key)){
            return this.bitnodeMultipliers[key]
        } else{
            return 1.0
        }
    }

    calculateIntelligenceBonus(weight=1){
      return 1 + (weight * Math.pow(this.intelligence(), 0.8)) / 600;
    }

    atHacknetHashLimit(){
      return this.hacknetHashCapacity() > 0 && this.hacknetNumHashes() == this.hacknetHashCapacity()
    }

    canCrackSsh(){ return this.files.includes("BruteSSH.exe") }
    canCrackSmtp(){ return this.files.includes("relaySMTP.exe") }
    canCrackSql(){ return this.files.includes("SQLInject.exe") }
    canCrackFtp(){ return this.files.includes("FTPCrack.exe") }
    canCrackHttp(){ return this.files.includes("HTTPWorm.exe") }
    currentBitnode(){ return this.info.bitNodeN }
    hacknetHashCapacity(){ return this.hacknetInfo.hashCapacity }
    hacknetNumHashes(){ return this.hacknetInfo.numHashes }
    hasFormulaApiAccess(){ return this.files.includes("Formulas.exe") }
    hasSourceFile(n, lvl=1){
      for(const sourceFile of this.singularity.ownedSourceFiles){
        if(sourceFile.n == n && sourceFile.lvl >= lvl){
          return true
        }
      }
      return false
    }
    hackingSkill(){ return this.info.hacking}
    hasTor(){ return this.info.tor }
    intelligence(){ return this.info.intelligence }
    busy(){ return this.singularity.busy }
    focused(){ return this.singularity.focused }
    money(){ return this.info.money }
    moneySpendable(){ return this.money() - this.context.cashReserve }
    numHashnetHashes(){ return }
    numPeopleKilled(){ return this.info.numPeopleKilled }
}

export class ServerInfo extends NetscriptDataProxy {

    static DEFAULTS = (context) => {
      return {
        info: {
          "cpuCores": 1,
          "ftpPortOpen": false,
          "hasAdminRights": false,
          "hostname": "",
          "httpPortOpen": false,
          "ip": "",
          "isConnectedTo": false,
          "maxRam": 2,
          "organizationName": "",
          "ramUsed": 0.0,
          "smtpPortOpen": false,
          "sqlPortOpen": false,
          "sshPortOpen": false,
          "purchasedByPlayer": false,
          "backdoorInstalled": false,
          "baseDifficulty": 1,
          "hackDifficulty": 1,
          "minDifficulty": 1,
          "moneyAvailable": 0,
          "moneyMax": 0,
          "numOpenPortsRequired": 5,
          "openPortCount": 0,
          "requiredHackingSkill": 1,
          "serverGrowth": 1
        },
        neighbors: [],
        files: [],
        processes: []
      }
    }
    static DEFAULT_INITIALIZER = (obj, context) => ServerInfo.DEFAULTS(context)

    constructor(hostname, pathFromHome){
        super(Context.instance().serverInitializer(), ServerInfo.DEFAULTS(Context.instance()))
        this.hostname = hostname
        this.pathFromHome = pathFromHome
    }

    procSearch(filename=null, args=null){
        var filtered = this.processes
        if(filename){
            filtered = filtered.filter(p => p.filename == filename)
        }
        if(args){
            filtered = filtered.filter(p => {
                for(var i in p.args){
                    if(p.args[i] != args[i]){
                        return false
                    }
                    return true
                }
            })
        }
        return filtered
    }
    availableRam(){ return this.maxRam() - this.ramUsed() }
    backdoorInstalled(){ return this.info.backdoorInstalled }
    codingContracts(){ return this.files.filter(f => f.endsWith(".cct")) }
    cpuCores(){ return this.info.cpuCores }
    growTime(){ return this.info.growTime }
    hackTime(){ return this.info.hackTime }
    hasCodingContracts(){ return this.codingContracts().length > 0 }
    hasFile(filename){ return this.files.includes(filename) }
    haveRootAccess(){ return this.info.hasAdminRights }
    isHacknetServer(){ return this.hostname.startsWith("hacknet-node")}
    isHome(){ return this.hostname == "home" }
    isMarkedForUpgrade(){ return this.files.includes(this.context.fileLock) }
    isPurchasedByPlayer(){ return this.info.purchasedByPlayer && !this.isHome() }
    maxRam(){ return this.info.maxRam }
    minSecurityLevel(){ return this.info.minDifficulty }
    moneyAvailable(){ return this.info.moneyAvailable }
    moneyMax(){ return this.info.moneyMax }
    numOpenPortsRequired(){ return this.info.numOpenPortsRequired }
    ramUsed(){ return this.info.ramUsed }
    requiredHackingSkill(){ return this.info.requiredHackingSkill }
    serverGrowth(){ return this.info.serverGrowth }
    serverSecurityLevel(){ return this.info.hackDifficulty }
    weakenTime(){ return this.info.weakenTime }
}

export class Network extends Base{
    constructor(){
        super()
        this.servers = []
    }

    async _scan(){

    }

    async refreshData(){
      this.servers = []
      var home = new ServerInfo("home", ["home"])
      let visited = { "home": home };
      let queue = [home];
      var currentNode;
      while ((currentNode = queue.pop())) {
          this.logger.trace("Scanning host: " + currentNode.hostname)
          await currentNode.refreshData()
          this.servers.push(currentNode)
          currentNode.neighbors.filter(n => visited[n] === undefined)
            .map(n => {
                var pathFromHome = [...currentNode.pathFromHome]
                pathFromHome.push(n)
                return new ServerInfo(n, pathFromHome)
            })
            .forEach(n => {
                visited[n.hostname] = n
                queue.push(n)
            })
      }
    }

    server(hostname){
        const match = this.allServers().filter(s => s.hostname == hostname)
        if(match && match.length > 0){
            return match[0]
        }
        return false
    }

    allServers(hostnamesOnly=false){
        return this._postProcess(this.servers, hostnamesOnly)
    }

    purchasedServers(hostnamesOnly=false){
        var servers = this.servers.filter(s => s.isPurchasedByPlayer() && !s.isHacknetServer())
        return this._postProcess(servers, hostnamesOnly, (a, b) =>  {
          if(a.maxRam() == b.maxRam()){
            if ( a.hostname < b.hostname ){
                return -1;
            }
            if ( a.hostname > b.hostname ){
                return 1;
            }
            return 0;
          }
          return a.maxRam() - b.maxRam()
        })
    }

    /**
     * Servers which need to be breached
     */
    vulnerableServers(hostnamesOnly=false){
        const context = this.context
        var servers = this.servers.filter(s => !s.isPurchasedByPlayer() && !s.isHome() && !s.haveRootAccess() && !s.isHacknetServer())
            .filter(s => s.numOpenPortsRequired() <= this.context.playerInfo.numCrackablePorts())
            .filter(s => s.requiredHackingSkill() <= this.context.playerInfo.hackingSkill())

        return this._postProcess(servers, hostnamesOnly)
    }

    /**
     * Servers which are available to run scripts
     */
    botnetServers(hostnamesOnly=false){
        var servers =  this.servers
          .filter(s => s.haveRootAccess() && !s.isMarkedForUpgrade())
          .filter(s => !s.isMarkedForUpgrade())
          .filter(s => !s.isHacknetServer() || this.context.playerInfo.atHacknetHashLimit())
        return this._postProcess(servers, hostnamesOnly)
    }

    /**
     * Servers which can be targeted for grow/weaken/hack
     */
    potentialTargetServers(hostnamesOnly=false){
        var servers = this.servers
            .filter(s => s.haveRootAccess() && !s.isPurchasedByPlayer() && !s.isHome() && !s.isHacknetServer())
            .filter(s => s.moneyMax() > 0 && s.serverGrowth() > 0)
        return this._postProcess(servers, hostnamesOnly, (a,b) => {
            return a.moneyMax() - b.moneyMax()
        })
    }

    serversWithCodingContracts(hostnamesOnly=false){
        var servers = this.servers
            .filter(s => s.hasCodingContracts())
        return this._postProcess(servers, hostnamesOnly)
    }

    _postProcess(servers, hostnamesOnly, sort_fn=null){
        if(sort_fn){
          servers = servers.sort(sort_fn)
        } else{
          servers = servers.sort((a, b) => {
              if ( a.hostname < b.hostname ){
                  return -1;
              }
              if ( a.hostname > b.hostname ){
                  return 1;
              }
              return 0;
          })
        }
        if(hostnamesOnly){
            servers = servers.map(s => s.hostname)
        }
        return servers
    }

    static utilization(servers){
  		return (Network.ramUsed(servers) / Network.maxRam(servers)) * 100.0
    }

    static maxRam(servers){
      return servers.reduce((sum, b) => sum + b.maxRam(), 0)
    }

    static ramUsed(servers){
      return servers.reduce((sum, b) => sum + b.ramUsed(), 0)
    }

    calculateHackingChance(server){
      const context = this.context
      const hackFactor = 1.75;
      const difficultyMult = (100 - server.serverSecurityLevel()) / 100;
      const skillMult = hackFactor * context.playerInfo.hackingSkill();
      const skillChance = (skillMult - server.requiredHackingSkill()) / skillMult;
      const chance =
        skillChance * difficultyMult * player.getHackingMultiplier("hack") * player.calculateIntelligenceBonus();
      if (chance > 1) {
        return 1;
      }
      if (chance < 0) {
        return 0;
      }

      return chance;
    }

}

export class Action extends Base{
    constructor(name, staticPriority=0){
        super()
        this.name = name
        this.staticPriority = staticPriority
    }

    taskResults(task, success, details=null, error=null){
      const result = {
        task: task,
        success: success
      }
      if(details != null){
        result.details = details
      }
      if(error != null){
        results.error = error
      }
      return result
    }

    actionResults(...taskResults){
      const overallSuccess = true
      for(const task of taskResults){
        if(!task.success){
          overallSuccess = false
          break
        }
      }
      return {
        action: this.name,
        success: overallSuccess,
        tasks: taskResults
      }
    }

    async priority(context){
      return this.staticPriority
    }

    async isActionable(context){
      throw new TypeError("You need to implement this yourself");
    }

    async performAction(context){
      throw new TypeError("You need to implement this yourself");
    }
}

export class Module extends Base{
  constructor(script, timeout){
      super()
      this.script = script
      this.timeout = timeout
  }

  async costWrapper(context, script){
    throw new TypeError("Not implemented yet")
  }

  async execWrapper(context, script, hostname, threads, args){
    throw new TypeError("Not implemented yet")
  }

  async killWrapper(context, script, host, args){
    throw new TypeError("Not implemented yet")
  }

  async isProcRunning(context){
    const host = await this.determineHost(context)
    await host.refreshData()
    const args = await this.determineArgs(context)
    const procs = host.procSearch(this.script, args)
    return procs && procs.length > 0
  }

  enabled(){
    return !this.context.disabledModules.includes(this.script)
  }

  async canLaunch(context){
    const threads = await this.determineThreads(context)
    const host = await this.determineHost(context)
    if(!host){
      this.logger.warn(StringFormatter.sprintf("Module %s unlaunchable: no host found.", this.script))
      return false
    }
    if(!context.network.server("home").hasFile(this.script)){
      this.logger.warn(StringFormatter.sprintf("Module %s unlaunchable: script not found.", this.script))
      return false
    }
    if(await this.isProcRunning(context)){
      this.logger.debug(StringFormatter.sprintf("Module %s unlaunchable: already running on %s.", this.script, host.hostname))
      return false
    }
    if(host.availableRam() < this.costWrapper(context, this.script)*threads){
      this.logger.debug(StringFormatter.sprintf("Module %s unlaunchable: not enough ram available on host %s.", this.script, host.hostname))
      return false //not enough ram
    }
    return true
  }

  async killProc(context){
    if(await this.isProcRunning(context)){
      const host = await this.determineHost(context)
      const args = await this.determineArgs(context)
      await this.killWrapper(context, this.script, host, args)
    }
  }

  async determineHost(context){
    return context.network.server("home")
  }

  async determineThreads(context){
    return 1
  }

  async determineArgs(context){
    return []
  }

  async launch(context){
    const host = await this.determineHost(context)
    const threads = await this.determineThreads(context)
    const args = await this.determineArgs(context)
    const results = {success: true, details: {host: host.hostname, script: this.script, threads: threads, args: args}}
    results.success = await this.execWrapper(context, this.script, host, threads, args)
    await host.refreshData()
    return results
  }
}

export class BotEngine extends Base{

    constructor(context){
      super()
      Context.initialize(context)
      context.loadConfig()
      context.setPlayerInfo(new PlayerInfo())
      context.setNetwork(new Network())
      this.modules = []
    }

    setModules(modules){
      this.modules = modules
      return this
    }

    async displayModules(){
        const table = new PrintableTable()
        table.setHeader(["Module", "Enabled", "Launchable", "RAM (GB)", "Exec Host", "Threads", "Args"])
        for(const module of this.modules){
            const launchable = await module.canLaunch(this.context)
            const host = await module.determineHost(this.context)
            const cost = await module.costWrapper(this.context, module.script)
            const threads = await module.determineThreads(this.context)
            const args = await module.determineArgs(this.context)
            table.addRow([module.script, module.enabled(), launchable, cost, host.hostname, threads, args])
        }
        table.sortRows(0)
        return table.toString()
    }

    async idle(){
      await this.logAggregator()
    }

    async main(){
        this.context.loadConfig()
        await this.context.refreshData()
        for(const module of this.modules){
          const launchable = await module.canLaunch(this.context)
          if(module.enabled() && launchable){
            this.logger.debug("Launching module: " + module.script)
            const results = await module.launch(this.context)

            // if you try to start processes too quickly they might fail due to RAM counts being off
            await this.context.ns.sleep(200)
            if(results.success){
              const start = Date.now()
              while(await module.isProcRunning(this.context)){
                this.logger.debug("Waiting for module to complete: " + module.script)
                if(Date.now()-start < module.timeout){
                  await this.idle()
                  await this.context.ns.sleep(200)
                } else{
                  this.logger.warn("Module " + module.script + " exceeded execution time.")
                  await module.killProc(this.context)
                }
              }
            } else{
              this.logger.warn("Module " + module.script + " failed to launch.", results)
            }
          }
        }
    }

    async logAggregator(){
      var logMsg = this.context.ns.readPort(this.context.logPort)
      while(logMsg != "NULL PORT DATA"){
        logMsg = JSON.parse(logMsg)
        const logger = Logger.getLogger(logMsg.name, logMsg.script)
        logger.log(logMsg.level, logMsg.msg, logMsg.data)
        logMsg = this.context.ns.readPort(this.context.logPort)
      }
      await Logger.emitLogs()
    }

    async daemon(sleepMs=500){
    	this.context.ns.clearLog()
    	Logger.disableNoisyLogs()
      await this.context.refreshData()
      this.logger.info(await this.displayModules())
      while(true){
    		await this.main()
        await this.idle()
    		await this.context.ns.sleep(sleepMs)
    	}
    }
}

export class ModuleEngine extends Base{

  constructor(context){
      super()
      Context.initialize(context)
      context.loadConfig()
      context.setPlayerInfo(new PlayerInfo())
      context.setNetwork(new Network())
      this.actions = []
  }

  setActions(actions){
    this.actions = actions
    return this
  }

  async displayActions(){
    const table = new PrintableTable()
    table.setHeader([" ", "Action", "Is Actionable"])
    for(const action of this.actions){
        const priority = await action.priority(this.context)
        const actionable = await action.isActionable(this.context)
        table.addRow([priority, action.name, actionable])
    }
    table.sortRows(0, 1)
    return table.toString()
  }

  async main(){
      try{
        this.context.ns.clearLog()
        Logger.disableNoisyLogs()
        this.context.loadConfig()
        await this.context.refreshData()
        this.logger.debug(await this.displayActions())

        var possibleActions = []
        for(const action of this.actions){
          if(await action.isActionable(this.context)){
            possibleActions.push({"action": action, "priority": await action.priority(this.context)})
          }
        }
        possibleActions.sort((a, b) => a.priority - b.priority)

        if(possibleActions.length > 0){
            const lowestPriority = possibleActions[0].priority
            var choosenActions = possibleActions
                .filter(a => a.priority == lowestPriority)
                .map(a => a.action)
            for(const action of choosenActions){
              // refresh context and check if still actionable incase a previous
              // action changed the state of things
              await this.context.refreshData()
              if(await action.isActionable(this.context)){
                const results = await action.performAction(this.context)
                const status = results && results.success ? "SUCCESS" : "FAILED"
                Logger.getLogger(action).info("Action: " + action.name + " - " + status, results)
              }
            }
        } else{
          this.logger.debug("Nothing to do.")
        }
      } catch(error){
        this.logger.error("Unexpected error", error)
      }
      await Logger.emitLogs()
  }
}

export class PrintableTable extends Base{
    constructor(){
        super()
        this.header = []
        this.rows = []
        this._maxLengths = []
    }

    _dataAsStrings(data){
      var dataAsStrings = []
      for(var i in data){
        if(data[i] == null || data[i] == undefined){
          dataAsStrings[i] = ""
        } else if(data[i].constructor.name == "String"){
          dataAsStrings[i] = data[i]
        }else if(data[i].constructor.name == "Array"){
          dataAsStrings[i] = this._dataAsStrings(data[i])
        } else if(data[i].constructor.name == "Object"){
          try{
            dataAsStrings[i] = JSON.stringify(data[i], null, 2).split("\n")
          } catch(error){
            dataAsStrings[i] = String(data[i])
          }
        } else if(typeof data[i].toString === "function"){
          dataAsStrings[i] = data[i].toString()
        } else{
          dataAsStrings[i] = String(data[i])
        }
      }
      return dataAsStrings
    }

    _updateMaxLengths(data){
        if(this._maxLengths.length == 0){
            data.forEach(d => this._maxLengths.push(0))
        }

        for(var i in data){
            var dataString = ""
            if(data[i].constructor.name == "Array"){
                for(var j in data[i]){
                    if(data[i][j].length > dataString.length){
                        dataString = data[i][j]
                    }
                }
            } else{
                dataString = data[i]
            }
            if(dataString.length > this._maxLengths[i]){
              this._maxLengths[i] = dataString.length
            }
        }
    }

    _addPadding(data){
        var padded = []
        var i = 0
        for(var i = 0; i < data.length; i++){
            var whiteSpaceNeeded = (this._maxLengths[i] - data[i].length) + 1
            var whitespace = whiteSpaceNeeded > 0 ? " ".repeat(whiteSpaceNeeded) : ""
            padded.push(" " + data[i]+whitespace)
        }
        return padded
    }

    _expandArrays(data){
        var subrows = []
        var numSubrows = data.reduce((max, col) => {
            if(col != null && col.constructor.name == "Array" && col.length > max){
                return col.length
            }
            return max
        }, 0)
        if(numSubrows == 0){
            subrows.push(data)
        } else{
            for(var i = 0; i < numSubrows; i++){
                var r = []
                for(var j in data){
                    if(data[j] != null && data[j].constructor.name == "Array"){
                        if(i < data[j].length){
                            r.push(data[j][i])
                        } else{
                            r.push(" ")
                        }
                    } else if(i == 0){
                        r.push(data[j])
                    } else{
                        r.push(" ")
                    }
                }
                subrows.push(r)
            }
        }
        return subrows
    }

    setHeader(header){
        this.header = header
        this._updateMaxLengths(this._dataAsStrings(header))
    }

    addRow(row){
        this.rows.push(row)
        this._updateMaxLengths(this._dataAsStrings(row))
    }

    sortRows(...columns){
        this.rows.sort((a, b) => {
            var sortCol = 0
            for(var i in columns){
                sortCol = columns[i]
                if(a[sortCol] !== b[sortCol]){
                    break
                }
            }
            return +(a[sortCol] > b[sortCol]) || +(a[sortCol] > b[sortCol]) - 1
        })
    }

    toString(){
        var buff = []
        var headerStrings = this._addPadding(this._dataAsStrings(this.header))

        var headerLine = StringFormatter.sprintf("|%s|", headerStrings.join("|"))
        var headerSep = "=".repeat(headerLine.length)
        var rowSep = "-".repeat(headerLine.length)
        buff.push(headerSep)
        buff.push(headerLine)
        buff.push(headerSep)

        this.rows.map(r => this._dataAsStrings(r))
          .map(r => this._expandArrays(r))
          .forEach(r => {
              for(var i in r){
                  buff.push(StringFormatter.sprintf("|%s|", this._addPadding(r[i]).join("|")))
              }
              buff.push(rowSep)
          })
        return buff.join("\n")
    }
}
