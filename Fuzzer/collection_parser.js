const axios = require('axios');
const querystring = require('querystring');
var yargs = require('yargs');
var shuffle = require('shuffle-array');

//-------------------------------------------------- CLI definition start --------------------------------------------------
yargs.version('1.0.0');

const argv = yargs
/*
There are two ways to use this CLI.
The first is to generate the configuation file:
  node .\collection_parser.js --pmanCollection '.\Postman-Collections\IOUCorDapp.postman_collection.json' --confOutputPath.\myTest.json --partyParams partyName,thisOtherOne

The second is to generated fuzzed requests and record the output of the results:
  node .\collection_parser.js --pmanCollection '.\Postman-Collections\IOUCorDapp.postman_collection.json' --paramConfig ..\SampleConfig.json --partyParams partyName,thisOtherOne --testOutputPath .\myTest.csv
*/
.command('--pmanCollection', 'Path to your Postman Collection',{
  pmanCollection: {
    description: 'path to the postman collection file',
    alias: 'pman',
    type: 'string',
  }
})
.command('--paramConfig', 'Path to your configuration file',{
  paramConfig: {
    description: 'the configuration file is used to control testing',
    alias: 'conf',
    type: 'string',
  }
})
.command('--testOutputPath', 'Path to where you would like to save your test results',{
  testOutputPath: {
    description: 'this file will contain error msgs, status codes, exec time, etc...',
    alias: 'out',
    type: 'string',
  }
})
.command('--confOutputPath', 'Path to where you want to save your generated configuration file',{
  confOutputPath: {
    description: 'the configuration file is used to control testing',
    alias: 'conf',
    type: 'string',
  }
})
.command('--partyParams', 'Comma delimited list of params which use Corda Partys',{
  partyParams: {
    description: 'once generated, you will have to edit the "peerList" as it will be blank by default',
    alias: 'conf',
    type: 'string',
  }
})
.help()
.showHelpOnFail(true, "Specify --help for available options")
.alias('help','h')
.argv;

if (!argv.pmanCollection){
  throw new Error("The --pmanCollection command is required");
}
else if(argv.paramConfig && !argv.testOutputPath){
  throw new Error("The --testOutputPath command is required when fuzzing");
}
else if(!argv.paramConfig && argv.testOutputPath){
  throw new Error("The --paramConfig command is required when setting a test output path");
}
else if(!argv.partyParams){
  throw new Error("The --partyParams command is required so the parser knows the name of your participant parameter");
}
else if(!argv.confOutputPath && !argv.testOutputPath){
  throw new Error("You must set an output path with --confOutputPath or --testOutputPath");
}
else if(argv.confOutputPath && argv.testOutputPath){
  throw new Error("You cannot set both --confOutputPath and --testOutputPath");
}
//-------------------------------------------------- CLI definition end --------------------------------------------------


//-------------------------------------------------- Global Vars Start --------------------------------------------------

const availableFuzzers = ["numbers", "text", "textAndNumbers", "textExtendedLang", "textAndSymbols"];

// parse postman collection using postman sdk
var fs = require('fs'),  Collection = require('postman-collection').Collection,  myCollection;
myCollection = new Collection(JSON.parse(fs.readFileSync(argv.pmanCollection).toString()));
let configMapJson;
let config;
//-------------------------------------------------- Global Vars End --------------------------------------------------


//-------------------------------------------------- main start --------------------------------------------------

if(argv.confOutputPath){
  if(argv.confOutputPath.substring(argv.confOutputPath.length-5, argv.confOutputPath.length) != ".json"){
    throw new Error("confOutputPath file must be of type .json");
  }
  console.log("Generating configuration file...")
  configMapJson = {};
  myCollection.forEachItem(

    function(item){
      if(item.request.method == "POST"){
        choosePostParserType(item)
      }
      else if(item.request.method == "GET" && item.request.url.query.members.length > 0){
        parseUrlEncodedGet(item);
      }
    }
  );
  writeToFile(argv.confOutputPath, JSON.stringify(configMapJson));
}
else{
  if(argv.testOutputPath.substring(argv.testOutputPath.length-4, argv.testOutputPath.length) != ".csv"){
    throw new Error("testOutputPath file must be of type .csv");
  }
  console.log("Generating fuzzed request results...")
  config = JSON.parse(fs.readFileSync(argv.paramConfig));

  // create csv file on path provided by user
  writeToFile(argv.testOutputPath, "Date, Url, Method, Status_Code, Payload, URI, Response");

  // for every request determine if it is a post or a get. Gets without params can just be ran.
  // posts must be examined for the body type and parameters configuration.
  myCollection.forEachItem(

    function(item){
      if(item.request.method == "POST"){
        requestByMode(item);
      }
      else if(item.request.method == "GET" && item.request.url.query.members.length > 0){
        // dynamicRequest(item.request.method, item.request.url.getRaw(), {});
        requestByMode(item);
      }
      else if(item.request.method == "GET"){
        dynamicRequest(item.request.method, item.request.url.getRaw(), {});
      }
      else{
        throw new Error(item.request.method + " is not currently supported.");
      }
    }
  );
}

//-------------------------------------------------- main end --------------------------------------------------

function writeToFile(_fileName, _content){
  fs.writeFile(_fileName, _content, 'utf8',
    function (err) {
      if (err) {
        console.log('Some error occured - file either not saved or corrupted file saved.');
      } 
  });    
}

function parseUrlEncodedGet(_item){
  for(paramIndex in _item.request.url.query.members){
    if(argv.partyParams.split(',').includes(_item.request.url.query.members[paramIndex].key)){
      configMapJson[_item.request.url.query.members[paramIndex].key] = configurationByFuzzer("participants")
    }else{
      configMapJson[_item.request.url.query.members[paramIndex].key] = {"fuzzers":{}}
      for(fuzzerIndex in availableFuzzers){
        configMapJson[_item.request.url.query.members[paramIndex].key]['fuzzers'][availableFuzzers[fuzzerIndex]] = configurationByFuzzer(availableFuzzers[fuzzerIndex]);
      }
    }
  }
}

function parseUrlEncodedPost(_item){
  for(paramIndex in _item.request.body.urlencoded.members){
    if(argv.partyParams.split(',').includes(_item.request.body.urlencoded.members[paramIndex].key)){
      configMapJson[_item.request.body.urlencoded.members[paramIndex].key] = configurationByFuzzer("participants")
    }else{
      configMapJson[_item.request.body.urlencoded.members[paramIndex].key] = {"fuzzers":{}}
      for(fuzzerIndex in availableFuzzers){
        configMapJson[_item.request.body.urlencoded.members[paramIndex].key]['fuzzers'][availableFuzzers[fuzzerIndex]] = configurationByFuzzer(availableFuzzers[fuzzerIndex]);
      }
    }
  }
}

function choosePostParserType(_item){
  var content = "";
  switch(_item.request.body.mode){
    case("Filler"):
      break;
    default:
      content = parseUrlEncodedPost(_item);
  }
  return content;
}

function configurationByFuzzer(_fuzzer){
  var configObj;
  switch(_fuzzer){
    case("participants"):
      configObj = {
        "peerList" : [],
        "maxPeers": 2,
        "minPeers": 1,
      }
      break;
    case("numbers"):
      configObj = {
        "min": Number.MIN_SAFE_INTEGER,
        "max": Number.MAX_SAFE_INTEGER,
        "decimalsMin" : 2,
        "decimalsMax" : 4,
        "runs": 5
      }
      break;
    default:
      //all text fuzzers
      configObj = {
        "minChars": 10,
        "maxChars": 200,
        "runs": 5
    }
  }
  return configObj;
}

/*
@PARAM method -> HTTP request method such as POST or GET
@PARAM url -> URL target of the request
@PARAM dataMap -> arguments parsed from postman collection which will be replaced with fuzzed versions
@DESCRIPTION -> the purpose of this function is to generate a request based on the given args and append the response to the csv file
*/
function dynamicRequest(method, url, dataMap){
  axios({
    method: method.toLowerCase(),
    url: url,
    params: dataMap
  })
   .then(function (response) {
    recordResponse(
      [
        response.headers.date.replace(/[,]/g,' '),
        response.config.url,
        response.config.method,
        response.status,
        JSON.stringify(response.config.params).replace(/[,]/g,' '),
        decodeURIComponent(response.request.res.responseUrl).replace(/[,]/g,' '),
        JSON.stringify(response.data).replace(/[,]/g,' ')
      ].join(', ')
    );
   })
  .catch(function (error) {
    recordResponse(
      [
        error.response.headers.date.replace(/[,]/g,' '),
        error.response.config.url,
        error.response.config.method,
        error.response.status,
        JSON.stringify(error.response.config.params).replace(/[,]/g,' '),
        decodeURIComponent(error.request.res.responseUrl).replace(/[,]/g,' '),
        JSON.stringify(error.response.data).replace(/[,]/g,' ')
      ].join(', ')
    );
  } );
}

/*
@PARAM item -> item is a request parsed from the postman collection
@DESCRIPTION -> the purpose of this function is to find params that are mentioned in the config
once found, we replace the value with a fuzzed value and execute a request.
*/
function urlEncodedRequestGenerator(_method, _params, _url){
  //search all parameters in current request   
  for(var index in _params){
     
      var currentKey = _params[index].key;
       // if we find one that is also in the config then we can start generating tests
      if((currentKey in config) && ("fuzzers" in config[currentKey])){
        
        var keyList = Object.keys(config[currentKey]["fuzzers"]);
        //since a match param was found, generate test for each fuzzer type where the number of tests is "runsPerFuzz"
        for(fuzzerKey in keyList){
          for(var i = 0; i < config[currentKey]['fuzzers'][keyList[fuzzerKey]]["runs"]; i++){
            dynamicRequest(
              _method, 
              _url, 
                buildFuzzedRequest(
                  currentKey,
                  keyList[fuzzerKey], 
                  _params
                )
            );
          }
        }
      }
    }
}

/*
@PARAM keyToFuzz -> the parameter name which will be mapped to a fuzzed value
@PARAM fuzzerType -> the current requested fuzz value type (number, text, textWithNumbers, etc...)
@DESCRIPTION -> this function builds a dataMap with fuzzed vales which will be used as a payload for a request.
*/
function buildFuzzedRequest(_keyTofuzz, _fuzzerType, _params=[]){
  var dataMap = {}
     for(var index in _params){
      dataMap[_params[index].key] = _params[index].value;
    }
  
  if(_fuzzerType == "numbers"){
    config[_keyTofuzz]['fuzzers'][_fuzzerType]
    dataMap[_keyTofuzz] = numberFuzzer(
      config[_keyTofuzz]['fuzzers'][_fuzzerType]["min"],
      config[_keyTofuzz]['fuzzers'][_fuzzerType]["max"],
      config[_keyTofuzz]['fuzzers'][_fuzzerType]["decimalsMin"],
      config[_keyTofuzz]['fuzzers'][_fuzzerType]["decimalsMax"]
    );
  }else{
    dataMap[_keyTofuzz] = textFuzzer(
      _fuzzerType,
      config[_keyTofuzz]['fuzzers'][_fuzzerType]["minChars"],
      config[_keyTofuzz]['fuzzers'][_fuzzerType]["maxChars"],
      );
  }
  //if this dataMap has any of the partyParams listed, then grabe the config for it
  
  var intersections = Object.keys(dataMap).filter(element => argv.partyParams.split(',').includes(element));
  if(intersections.length > 0){
    
    dataMap[intersections[0]] = getRandomPeer(
      [...config[intersections[0]]["peerList"]], 
      config[intersections[0]]["peerList"]["minPeers"],
      config[intersections[0]]["peerList"]["maxPeers"]
      );
  }
  return dataMap;
}

/*
@PARAM item -> item is a request parsed from the postman collection
@DESCRIPTION -> Assuming there will be more body types to handle in the future,
this function will prepare the request for the proper type. For now we are just
handling urlencoded and the other switch cases are fillers.
*/
function requestByMode(item){
  if(item.request.method == "POST"){
    urlEncodedRequestGenerator(
      item.request.method, 
      item.request.body.urlencoded.members,
      item.request.url.getRaw()
      );
  }
  else if(item.request.method == "GET"){
    urlEncodedRequestGenerator(
      item.request.method, 
      item.request.url.query.members,
      item.request.url.protocol + "://" + item.request.url.host + ":" + item.request.url.port + "/" + item.request.url.path
      );
  }
}

/*
@PARAM -> min is the smallest number that will be used in the rng (inclusive)
@PARAM -> max is the largest number that will be used in the rng (non-inclusive)
@PARAM -> min is the least amount of digits that will be used in the rng (inclusive)
@PARAM -> max is the largest amount of digits that will be used in the rng (non-inclusive)
@DESCRIPTION -> This funciton is responsible for producing random numbers.
 */
function numberFuzzer(min=Number.MIN_SAFE_INTEGER, max=Number.MAX_SAFE_INTEGER, decimalsMin=1, decimalsMax=4){
  var decimal = 0;
  if(decimalsMax > 1){
      var decimals = Math.floor(Math.random() * (decimalsMax - decimalsMin) + decimalsMin);

      var decimalMax = 10**decimals

      var decimalNumber = Math.floor(Math.random() * decimalMax);
  
      decimal = decimalNumber/decimalMax
  }

  var mainNum = Math.random() * (max - min) + min;

  return Math.floor(mainNum) + decimal;
}
/*
Min / Max length
Random a-z/A-Z: AJnvaKLJzsd
Random a-z/A-Z extended languages: 
Random a-z/A-Z + numbers: s8Av9apJd1
Random a-z/A-Z + symbols: aJ

@DESCRIPTION -> function responsible for producing randomly generated strings. The default is the standard
alphabet with capitalized and non-capitalized letters. Others are:
- textExtendedLang which includes other langurages such as greek along with the standard set
- textAndNumbers which leverages the numberFuzzer to add numbers to the string
- textAndSymbols which will include symbols such as emojis along with the standard set
*/
function textFuzzer(fuzzType="text", minLength=1, maxLength=100){
    
  var characterLib = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z']

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
  if(peers.length == 1){
    peers = peers[0]
  }
  return peers; 
}

function recordResponse(_data){
  fs.appendFile(argv.testOutputPath, 
    '\n'+_data, 
    'utf8',
    function (err) {
      if (err) {
        console.log('Some error occured - file either not saved or corrupted file saved.');
      } 
    }
  );
}

