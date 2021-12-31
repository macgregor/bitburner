const MANIFEST_URL = "https://raw.githubusercontent.com/macgregor/bitburner/master/bot/manifest.json"

async function copy(ns, sourceFilename, destFilename){
  if(ns.fileExists(sourceFilename)){
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
  await backup(ns, localFilename)
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
    try{
      data = JSON.parse(data)
    } catch(error){
      ns.tprint("Unexpected error parsing data " + error)
      return false
    }
  }
  return data
}

function validateManifest(ns, manifest){
  var buffer = []

  function validateKey(key, dataType){
    if(!manifest.hasOwnProperty(key)){
      buffer.push("missing field '"+key+"'")
    } else if(typeof manifest[key] != dataType){
      buffer.push("'"+key+"' should be type '"+dataType+"' but is '" + typeof manifest[key]+"'")
    }
  }


  if(!manifest){
    buffer.push("no manifest data")
  } else {
    validateKey("files", "object")
    validateKey("entry", "string")
  }

  if(buffer.length > 0){
    ns.tprint("Invalid manifest:\n" + buffer.join("\n  - "))
    return false
  }
  return true
}

export async function main(ns) {
  const manifest = await downloadFile(ns, MANIFEST_URL, "manifest.txt", true)
  ns.tprint(JSON.stringify(manifest, null, 2))
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
