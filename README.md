# CorDapp Fuzzer CLI 1.0.0
The purpose of this project is to create an applicatoin which can identify input validation errors. The integrity of a DLT app is based on the accuracy of the ledger. Therefore all payloads given to a flow should be as close to perfect as possible in order for a flow to successfully write to ledger. By using fuzzed inputs, we can see where a CorDapp's flows and/or Contract logic is lacking sufficient logical 
checks.


## Fuzzer
This directory holds the application used to scan a postman collection, generate randomized "Fuzzed" payloads, and execute them. 

### Usage
```--pmanCollection``` Path to your Postman Collection.  
```--paramConfig``` Path to your configuration file.  
```--outputPath``` Path to where you would like to save your test results.  
```--version``` Show version number.  
```-r, --runs``` Number of test runs per discovered endpoint (default is 1).  
```-h, --help``` Show help menu.  

Example: *node .\collection_parser.js --pmanCollection '.\Postman-Collections\IOUCorDapp.postman_collection.json' --paramConfig ..\SampleConfig.json --outputPath .\myTest.csv*

## CorDapp
This is a simple CorDapp capable of generate IOUs.

### Starting the IOU Nodes
From the */Fuzzing/CorDapp/* directory:
- Create your nodes by running `./gradlew deployNodes`.
- Start your nodes by running the `build\nodes\runnodes` command.

### Starting the Spring Webserver
- Build the Spring jar file by running `./gradlew clients::bootJar` command fromt the */CorDapp* directory.
- Start the server with: `java -jar .\clients-0.1.jar --server.port:8080 --config.rpc.host=localhost --config.rpc.port=10006 --config.rpc.username=user1 --config.rpc.password=test` from the */CorDapp/clients/build/libs* directory
