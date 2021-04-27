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
console.log(myCollection.toJSON());