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
    switch(item.request.method) {
      case "POST":
        execURLEncodedRequest(
          item.request.url.getRaw(), 
          buildDataMap(item.request.body.urlencoded.members)
          );
        break;
      default:
          execBasicGET(item.request.url.getRaw());
    };
  }
);

function execBasicGET(url){
  axios({
    method: "get",
    url: url
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

function execURLEncodedRequest(url, data){
  axios({
    method: "post",
    url: url,
    data:  querystring.stringify(data)
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
function buildDataMap(urlencodedMembers){
  var dataMap = {};
  var index;
  for(index in urlencodedMembers){
    dataMap[urlencodedMembers[index].key] = urlencodedMembers[index].value;
  }
  return dataMap;
}