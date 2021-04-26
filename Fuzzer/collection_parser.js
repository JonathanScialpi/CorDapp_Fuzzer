var fs = require('fs'),
  Collection = require('postman-collection').Collection,
  myCollection;

myCollection = new Collection(JSON.parse
  (fs.readFileSync('Decentralized Corpus Manager.postman_collection.json').toString()));

console.log(myCollection.toJSON());