const got = require('got');
const sleep = time => new Promise(resolve => setTimeout(resolve, time));
const fs = require('fs');

let host, token, wait;

async function call_api(path, data){
  data['i'] = token;

  let req = {
    url: `https://${host}/api/${path}`,
    method: 'POST',
    json: data,
    responseType: 'json'
  };

  let result;

  try{
    result = await got(req);
  }catch(e){
    throw e;
  }

  return result.body;
}

async function get_folders(folder_id = null){
  let is_not_done = true;
  let until_id = null;
  let folders = [];

  while(is_not_done){
    let data = {
      limit: 100
    }

    if(until_id) data.untilId = until_id;
    if(folder_id) data.folderId = folder_id;

    let result;

    try{
      result = await call_api('drive/folders', data);
      if(!result.length) break;
      folders = folders.concat(result);
    }catch(e){
      console.log(e);
      process.exit(1);
    }

    let sub_folders = [];
    for(let folder of result){
      let sub_folder = await get_folders(folder.id);
      sub_folders = sub_folders.concat(sub_folder);
    }

    folders = folders.concat(sub_folders);

    until_id = result[result.length -1].id;
    if(result.length < 100) is_not_done = false;
    await sleep(wait);
  }

  return folders.filter((el, i, self) => self.indexOf(el) === i);
}

async function get_files(folder_id = null){
  let is_not_done = true;
  let until_id = null;

  let files = [];

  while(is_not_done){
    let data = {
      limit: 100
    }

    if(until_id) data.untilId = until_id;
    if(folder_id) data.folderId = folder_id;

    let result;

    try{
      result = await call_api('drive/files', data);
      files = files.concat(result);
    }catch(e){
      console.log(e);
      process.exit(1);
    }

    until_id = result[result.length -1].id;
    if(result.length < 100) is_not_done = false;
    await sleep(wait);
  }

  return files.filter((el, i, self) => self.indexOf(el) === i);
}

async function download(url){
  var opt = {
    url: url,
    method: 'GET',
    responseType: 'buffer'
  };

  let body;

  try{
    body = await got(opt);
    body = body.body;
  }catch(e){
    console.log(e);
    process.exit(1);
  }

  return body;
}

async function main(){
  host = process.argv[2];
  token = process.argv[3];
  wait = process.argv[4] ? process.argv[4] : 1500;

  console.log(`Set wait time: ${wait}ms`);

  let folders = await get_folders();
  let results = {};

  for(let folder of folders){
    let result = await get_files(folder.id);
    results[folder.id] = result;
  }

  results['TOPFILES'] = await get_files();

  let count = 0;
  for(let key in results) count += results[key].length;

  for(let folder_info of folders){
    let info = folder_info;
    let f_path = folder_info.name;
    while(true){
      if(!info.parentId) break;

      let parent = folders.find(el => el.id == info.parentId);
      f_path = parent.name + "/" + f_path;

      info = parent;
    }

    folder_info.path = f_path;
    try{
      fs.mkdirSync('./dumps/' + f_path, { recursive: true });
    }catch(e){
      console.log(e);
      process.exit(1);
    }
  }

  let writed_count = 0;
  for(let key in results){
    let info;

    if(key == "TOPFILES"){
      info = { path: "" };
    }else{
      info = folders.find(el => el.id == key);
    }

    let files = results[key];

    for(let file of files){
      let buf = await download(file.url);
      try{
        fs.writeFileSync(`./dumps/${info.path}/${file.name}`, buf);
        writed_count++;
        console.log(`(${writed_count}/${count}) Download: ${file.name}`);
      }catch(e){
        console.log(e);
        process.exit(1);
      }

      await sleep(wait);
    }
  }
}

main();
