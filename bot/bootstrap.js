const MANIFEST_URL = "https://raw.githubusercontent.com/macgregor/bitburner/master/bot/manifest.json"

async function copy(ns, sourceFilename, destFilename){
  if(ns.fileexists(sourceFilename)){
    const data = ns.read(sourceFilename)
    await ns.write(destFilename, data, "w")
    return true
  }
  return false
}

async function backup(ns, filename){
  const backupFilename = "backup_"+filename
  if(await copy(ns, filename, backupFilename)){
    ns.tprint("Created backup " + backupFilename)
  }
}

async function restore(ns, filename){
  const backupFilename = "backup_"+filename
  if(await copy(ns, backupFilename, filename)){
    ns.tprint("Restored from backup " + backupFilename)
  }
}

async function downloadFile(ns, url, localFilename, isJson=false){
  await backup(localFilename)
  ns.rm(localFilename)
  if(!await ns.wget(url, localFilename)){
    ns.tprint("Unable to download file from " + url)
    await restore(ns, localFilename)
    return false
  }
  var data = ns.read(localFilename)
  if(data == ""){
    ns.tprint("No data found at " + localFilename)
    await restore(ns, localFilename)
    return false
  } else if(isJson){
    data = JSON.parse(data)
  }
  return data
}

function validateManifest(ns, manifest){
  var buffer = []

  function validateKey(key, constructorType){
    if(!manifest.hasOwnProperty(key)){
      buffer.push("missing field '"+key+"'")
    } else if(manifest[key].constructor.type != constructorType){
      buffer.push("'"+key+"' should be type '"+constructorType+"' but is '" + manifest.files.constructor.type+"'")
    }
  }


  if(!manifest){
    buffer.push("no manifest data")
  } else {
    validateKey("files", "Object")
    validateKey("entry", "String")
  }

  if(buffer.length > 0){
    ns.tprint("Invalid manifest:\n" + buffer.join("\n  - "))
    return false
  }
  return true
}

export async function main(ns) {
  const manifest = await downloadFile(ns, MANIFEST_URL, "manifest.txt", true)
  if(!validateManifest(ns, manifest)){
    ns.tprint("ERROR unable to continue")
    return
  }

  for(let [filename, url] of Object.entries(manifest.files)){
    if(!await downloadFile(ns, url, filename, false)){
      ns.tprint("ERROR unable to continue")
      return
    } else{
      ns.tprint("Downloaded " + filename + " from " + url)
    }
  }

  ns.tprint("Bot updated.")
  ns.tprint("For help run '"+manifest.entry+"'")

}
