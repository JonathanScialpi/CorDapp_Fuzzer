const axios = require('axios');
const querystring = require('querystring');
var yargs = require('yargs');

yargs.version('1.0.0');

const argv = yargs
.command('--path', 'Path to your Postman Collection',{
  path: {
    description: 'path to the postman collection file',
    alias: 'p',
    type: 'string',
  }
})
.option('runs',{
  alias: 'r',
  description: 'number of test runs per discovered endpoint',
  type: 'int',
})
.help()
.showHelpOnFail(true, "Specify --help for available options")
.alias('help','h')
.argv;

if (!argv.path){
  throw new Error("The path variable is required");
}

var fs = require('fs'),  Collection = require('postman-collection').Collection,  myCollection;

myCollection = new Collection(JSON.parse  (fs.readFileSync(argv.path).toString()));

myCollection.forEachItem(
  
  function(item){
    if(item.request.method == "POST"){
      postRequestByMode(item);
    }
    else if(item.request.method == "GET"){
      dynamicRequest(item.request.method, item.request.url.getRaw(), buildDataMap());
    }
    else{
      throw new Error(item.request.method + " is not currently supported.");
    }
  }
);

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
  .then(function () {
    // always executed
  });
}

function buildDataMap(params=[]){
  var dataMap = {}
  var index;
  for(index in params){
    dataMap[params[index].key] = params[index].value;
  }
  return dataMap;
}

function postRequestByMode(item){
  switch(item.request.body.mode) {
    case "FillerMode1":
      // code block
      break;
    case "FillerMode2":
      // code block
      break;
    default:
      // default POST request will be executed as urlencoded for now
      dynamicRequest(item.request.method, item.request.url.getRaw(), querystring.stringify(buildDataMap(item.request.body.urlencoded.members)));
  };
}