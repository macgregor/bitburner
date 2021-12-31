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

 /** need to be outside of Logger due to some particulars about how javascript
  * initializes class and static attributes, declaration order matters if you
  * want to avoid circular dependency issues
  */
async function PortLogEmitter(script, name, level, msg, data=null){
 const context = Context.instance()
 level = level.toLowerCase()
 var time = new Date().toUTCString()
 var logMsg = {
   script: this.script,
   name: this.name,
   time: new Date().toUTCString(),
   level: level.toLowerCase(),
   msg: msg,
   data: data
 }
 if(LOG_LEVELS[level] <= LOG_LEVELS[context.logLevel(name)]){
   return context.ns.writePort(context.logPort, JSON.stringify(logMsg))
 }
}

/** need to be outside of Logger due to some particulars about how javascript
 * initializes class and static attributes, declaration order matters if you
 * want to avoid circular dependency issues
 */
async function NativeLogEmitter(script, name, level, msg, data=null){
 const context = Context.instance()
 level = level.toLowerCase()
 var time = new Date().toUTCString()

 var logMsg = StringFormatter.sprintf("[%s] - %s - %s - %s: \n%s", time, level, script, name, msg)
 if(data){
   logMsg += "\n" + JSON.stringify(data, null, 2)
 }

 if(LOG_LEVELS[level] <= LOG_LEVELS[context.logLevel(name)]){
   return context.ns.print(logMsg)
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
       this.logLevels = {"root": "info"}

       var config = {}
       try{
         config = JSON.parse(ns.read(configFilename))
       } catch(error){
         Logger.getLogger(this).error("Unable to parse config file")
       }
       this.logPort = orElse(config, "logPort", 1)
       this.cashReserve = orElse(config, "cashReserve", 10000000)
       this.homeRamReserve = orElse(config, "homeRamReserve", 32)
       this.purchaseServerHostname = orElse(config, "purchaseServerHostname", "pserv")
       this.fileLock = orElse(config, "fileLock", "_lock.txt")
       this.disabledModules = orElse(config, "disabledModules", [])
       this.logLevels = orElse(config, "loggers", this.logLevels)
       this.logLevels.root = orElse(this.logLevels, "root", "info")
        }
   }

   setPlayerInfo(playerInfo){
     this.playerInfo = playerInfo
     return this
   }

   setNetwork(network){
     this.network = network
     return this
   }

   setLogEmitter(emitter){
     this.logEmitter = emitter
     return this
   }

   logEmitter(){
     return NativeLogEmitter
   }

   logLevel(name){
      for(const [logName, level] of Object.entries(this.logLevels)){
        if(logName == name){
          return level
        }
      }
      return this.loggers.root
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
 constructor(ns, args=null){
     super(ns, args)
 }

 logEmitter(){
   return PortLogEmitter
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
   } else if(name.constructor.name != "String"){
     name = "lib."+name.constructor.name
   }

   const context = Context.instance()
   if(!script){
     script = context && context.ns ? context.ns.getScriptName() : ""
   }
   const logEmitter = context && context.logEmitter() ? context.logEmitter() : NativeLogEmitter
   var key = script+name
   if(!Logger._LOGGERS.hasOwnProperty(key)){
     Logger._LOGGERS[key] = new Logger(script, name, logEmitter)
   }
   if(Logger._LOGGERS[key].emitter != logEmitter){
     Logger._LOGGERS[key].emitter = logEmitter
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
   const emitter = Context.instance().logEmitter()
   const localBuffer = Logger._BUFFER
   Logger._BUFFER = []
   for(const log of Logger._BUFFER){
     await emitter(...log)
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
    hacknetHashCapacity(){ return this.hacknetInfo.hashCapacity }
    hacknetNumHashes(){ return this.hacknetInfo.numHashes }
    hasFormulaApiAccess(){ return this.files.includes("Formulas.exe") }
    hackingSkill(){ return this.info.hacking}
    hasTor(){ return this.info.tor }
    intelligence(){ return this.info.intelligence }
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

    async refreshData(){
        await this._scan()
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
    constructor(name){
        super()
        this.name = name
    }

    async priority(context){
      throw new TypeError("You need to implement this yourself");
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
    const args = await this.determineArgs(context)
    const procs = host.procSearch(this.script, args)
    return procs && procs.length > 0
  }

  async canLaunch(context){
    if(context.disabledModules.includes(this.script)){
      this.logger.debug(StringFormatter.sprintf("Module %s unlaunchable: disabled in config file.", this.script))
      return false
    }

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
    return results
  }
}

export class BotEngine extends Base{

    constructor(context, modules){
      super()
      Context.initialize(context)
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
        table.setHeader(["Module", "Host", "Threads", "Args"])
        for(const module of this.modules){
            const host = await module.determineHost(this.context)
            const threads = await module.determineThreads(this.context)
            const args = await module.determineArgs(this.context)
            table.addRow([module.script, host.hostname, threads, args])
        }
        table.sortRows(0)
        return table.toString()
    }

    async idle(){
      await this.logAggregator()
    }

    async main(){
        await this.context.refreshData()
        for(const module of this.modules){
          const launchable = await module.canLaunch(this.context)
          if(launchable){
            this.logger.debug("Launching module: " + module.script)
            const results = await module.launch(this.context)
            if(results.success){
              const start = Date.now()
              while(await module.isProcRunning(this.context)){
                if(Date.now()-start < module.timeout){
                  await this.idle()
                  await this.context.ns.sleep(200)
                } else{
                  this.logger.warn("Module " + module.script + " exceeded execution time.")
                  await module.killProc(this.context)
                }
              }
            }
          }
        }
    }

    async logAggregator(){
      if(!this.context) return

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
      this.logger.debug(await this.displayModules())
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
        table.addRow([priority.toString(), action.name, actionable])
    }
    table.sortRows(0, 1)
    return table.toString()
  }

  async main(){
      this.context.ns.clearLog()
      Logger.disableNoisyLogs()
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
            const results = await action.performAction(this.context)
            const status = results && results.success ? "SUCCESS" : "FAILED"
            const details = results && results.details ? results.details : false
            this.logger.info("Action: " + action.name + " - " + status)
            if(details){
              this.logger.info("Details: ", details)
            }
          }
      } else{
        this.logger.debug("Nothing to do.")
      }
  }
}

export class PrintableTable extends Base{
    constructor(){
        super()
        this.header = []
        this.rows = []
        this._maxLengths = []
    }

    _updateMaxLengths(data){
        if(this._maxLengths.length == 0){
            data.forEach(d => this._maxLengths.push(0))
        }

        for(var i in data){
            var dataString = data[i] != null ? data[i].toString() : "null"
            if(data[i] && data[i].constructor.name == "Array"){
                dataString = ""
                for(var j in data[i]){
                    if(data[i][j].length > dataString.length){
                        dataString = data[i][j]
                    }
                }
            }
            if(dataString.length > this._maxLengths[i]){
                this._maxLengths[i] = data[i].length
            }
        }
    }

    _addPadding(data){
        var padded = []
        var i = 0
        for(var i = 0; i < data.length; i++){
            var dataString = data[i] != null ? data[i].toString() : "null"
            var whiteSpaceNeeded = (this._maxLengths[i] - dataString.length) + 1
            var whitespace = whiteSpaceNeeded > 0 ? " ".repeat(whiteSpaceNeeded) : ""
            padded.push(" " + dataString+whitespace)
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
        this._updateMaxLengths(header)
    }

    addRow(row){
        this.rows.push(row)
        this._updateMaxLengths(row)
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
        var headerLine = StringFormatter.sprintf("|%s|", this._addPadding(this.header).join("|"))
        var headerSep = "=".repeat(headerLine.length)
        var rowSep = "-".repeat(headerLine.length)
        buff.push(headerSep)
        buff.push(headerLine)
        buff.push(headerSep)

        this.rows.forEach(r => {
            var expanded = this._expandArrays(r)
            for(var i in expanded){
                buff.push(StringFormatter.sprintf("|%s|", this._addPadding(expanded[i]).join("|")))
            }
            buff.push(rowSep)
        })
        return buff.join("\n")
    }
}
