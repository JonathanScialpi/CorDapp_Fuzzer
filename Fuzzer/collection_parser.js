const axios = require('axios');
const querystring = require('querystring');
var yargs = require('yargs');
var shuffle = require('shuffle-array');

yargs.version('1.0.0');

const argv = yargs
.command('--pmanCollection', 'Path to your Postman Collection',{
  pmanCollection: {
    description: 'path to the postman collection file',
    alias: 'pman',
    type: 'string',
  }
})
.command('--paramConfig', 'Path to your Postman Collection',{
  paramConfig: {
    description: 'path to the postman collection file',
    alias: 'conf',
    type: 'string',
  }
})
.help()
.showHelpOnFail(true, "Specify --help for available options")
.alias('help','h')
.argv;

//-------------------------------------------------- main start --------------------------------------------------

if (!argv.pmanCollection){
  throw new Error("The postman collection command is required");
}else if(!argv.paramConfig){
  throw new Error ("The config command is required");
}

var fs = require('fs'),  Collection = require('postman-collection').Collection,  myCollection;

myCollection = new Collection(JSON.parse(fs.readFileSync(argv.pmanCollection).toString()));
let config = JSON.parse(fs.readFileSync(argv.paramConfig));
// console.log(type(config))

// First run of all requests to test that they work and to attain the peerlist
myCollection.forEachItem(

  function(item){
    if(item.request.method == "POST"){
      parseConfig(item);
    }
    else if(item.request.method == "GET"){
      // dynamicRequest(item.request.method, item.request.url.getRaw(), buildDataMap());
      console.log("Skipping GETs for now...")
    }
    else{
      throw new Error(item.request.method + " is not currently supported.");
    }
  }
);

//-------------------------------------------------- main end --------------------------------------------------

function dynamicRequest(method, url, dataMap){
  axios({
    method: method.toLowerCase(),
    url: url,
    data: dataMap
  })
  .then(function (response) {
    console.log(response);
  })
  .catch(function (error) {
    console.log(error);
  })
  // .then(function () {})
  ;
}

function parseConfig(_item){
  var params = _item.request.body.urlencoded.members;
  //search all parameters in current request   
  for(var index in params){
     
      var currentKey = params[index].key;
       // if we find one that is also in the config then we can start generating tests
      if(currentKey in config){
        for(fuzzerIndex in config[currentKey]["fuzzers"]){
          for(var i = 0; i < config[currentKey]["runsPerFuzz"]; i++){
            postRequestByMode(
              _item,
              buildFuzzedRequest(
                currentKey,
                config[currentKey]["fuzzers"][fuzzerIndex], 
                params
              )
            );
          }
        }
      }
    }
}

function buildFuzzedRequest(_keyTofuzz, _fuzzerType, _params=[]){
  var dataMap = {}
     for(var index in _params){
      dataMap[_params[index].key] = _params[index].value;
    }
  
  if(_fuzzerType == "numbers"){
    dataMap[_keyTofuzz] = numberFuzzer();
  }else{
    dataMap[_keyTofuzz] = textFuzzer(_fuzzerType);
  }
  
  if(dataMap[config["peerParam"]]){
    dataMap[config["peerParam"]] = getRandomPeer(
      [...config[config["peerParam"]]["peerList"]], 
      config[config["peerParam"]]["minPeers"],
      config[config["peerParam"]]["maxPeers"]
      );
      console.log("PEER WAS: " + dataMap["partyName"])
  }
  return dataMap;
}

function postRequestByMode(item, requestData){
  switch(item.request.body.mode) {
    case "FillerMode1":
      // code block
      break;
    case "FillerMode2":
      // code block
      break;
    default:
      // default POST request will be executed as urlencoded for now

      // first make a request with existing values in collection to 
      dynamicRequest(
        item.request.method, 
        item.request.url.getRaw(), 
        querystring.stringify(
          // buildDataMap(item.request.body.urlencoded.members)
          requestData
          ));
  };
}

/* 
Fuzzer options: number, text, x500name, x500nameFromList
Params to apply to: Default is all, listOfKeys to apply to
*/

// random number of decimal points between 0-3 decimals
// random number between int min and int max
function numberFuzzer(min=Number.MIN_SAFE_INTEGER, max=Number.MAX_SAFE_INTEGER, decimalsMin=1, decimalsMax=4){
  var decimal = 0;
  if(decimalsMax > 1){
      var decimals = Math.floor(Math.random() * (decimalsMax - decimalsMin) + decimalsMin);
  // console.log("number of decimals: " + decimals)

      var decimalMax = 10**decimals
      // console.log("decimalMax: " + decimalMax)

      var decimalNumber = Math.floor(Math.random() * decimalMax);
      // console.log("decimalNumber: " + decimalNumber)
  
      decimal = decimalNumber/decimalMax
      // console.log("decimal: " + decimal)
  }

  var mainNum = Math.random() * (max - min) + min;
  // console.log("main numb: " + mainNum)

  return Math.floor(mainNum) + decimal;
}
/*
Min / Max length
Random a-z/A-Z: AJnvaKLJzsd
Random a-z/A-Z extended languages: 
Random a-z/A-Z + numbers: s8Av9apJd1
Random a-z/A-Z + symbols: aJ
*/
function textFuzzer(fuzzType="text", minLength=1, maxLength=100){
    
  var characterLib = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z']

  //choose library
  switch(fuzzType) {
      case "textExtendedLang":
          characterLib = characterLib.concat(require('@unicode/unicode-11.0.0/General_Category/Lowercase_Letter/symbols.js')).concat(require('@unicode/unicode-11.0.0/General_Category/Lowercase_Letter/symbols.js'));
          break;
      case "textAndNumbers":
          characterLib = characterLib.concat(['0','1','2','3','4','5','6','7','8','9']);
          break;
      case "textAndSymbols":
          characterLib = characterLib.concat(require('@unicode/unicode-11.0.0/General_Category/Symbol/symbols.js')); 
          break;
      default:
          characterLib = characterLib
  }
  var textLength = numberFuzzer(minLength, maxLength, 0, 0)
  var fuzzedText = []
  while(fuzzedText.length < textLength){
      fuzzedText.push(characterLib[numberFuzzer(0, characterLib.length, 0, 0)]);
  }
  return fuzzedText.join('');
}

function getRandomPeer(_peerList, _minPeers=1, _maxPeers=2){
  shuffle(_peerList)
  var peerListSize = numberFuzzer(_minPeers, _maxPeers, 0, 0)
  var peers = []
  while(peers.length < peerListSize){
    peers.push(_peerList.pop())
  }
  return peers; 
}