console.log("hello world")
// Created by James to confirm customs things

// CS = customer shipments

// Set up packages/Modules.
var fs = require('fs');
const { readdir } = require('fs/promises');
const path = require('path')
const axios = require('axios');
var FormData = require('form-data');
const { parse } = require("csv-parse");
const { channel } = require('diagnostics_channel');

// May put into a constant. 
require('dotenv').config()

// Prepare Constants Here = replace test with "REAL" in production
const MERCHANT = process.env.TEST_MERCHANT
const API_KEY = process.env.TEST_API_KEY

// Getting this to write to a file shenanigans 
const insertDatePrepare = Date.now().toString()
const insertDate = insertDatePrepare
// HELPER FUNCTIONS. 
//This is a hacky version of the delay funtion. A more efficient method may be implemented later.  

const delay = async (milliseconds) =>{
    return new Promise(resolve =>{
      setTimeout(resolve, milliseconds);
    });
  }

const pauseMe = async (limitLogic)=>{
  var now = Date.now()
  var timeDif = now - limitLogic.interval /// Remove
  console.log(timeDif)
  if(timeDif < 1000){
    await delay(1000-timeDif)
  } 
  limitLogic.pause = 0;
  limitLogic.interval = Date.now()
}


  // The following is used to create the output files.
const createWriteLogFiles = async ( folder, name , arrayData )=>{

    var tempString = await path.join(__dirname, folder, name)
    tempString = __dirname+'/'+folder+'/'+name 
    var file1 = fs.createWriteStream(tempString);
    file1.on('error', function(err) { /* error handling */ });

    var index = 0;
    while(index < arrayData.length){
      var toString = "NotStringAble/Null"
      if(arrayData[index] != null){
        toString = arrayData[index].toString();
      }
      await file1.write(toString); 
      await file1.write("\n")
      index = index + 1;
    }// while

    file1.end();
}
// 

// The following programs is responsible for splitting Customer Shipments based on how many channels is associated with it. 
// Returns an array of CS That have more than one channel associated with it. 
  /// #### TODO Modify Function such that it only checks new CS in a given interval. Other criteria may be added to narrow the search. 

const retrieveCsList = async () => {
  // Result Array is responsible for holding all of the CS ids formatted in such a way that search_read can use. 
  var resultArray = [];
  // Safe Array is named because it will be able to hold every order retrievd. "It is safe" from a limit. It will contain all of the results.
  // It will only hold CS ids. In addition,
  var safeArray = [];
  // Set up filter. 
  // #### I want to be able to add a filter to help narrow down the CS Here. 
  var dataConfigCsList  = JSON.stringify({
    "filters": [
      [
        "state",
        "=",
        "waiting"
      ], 
    ],
  });


  var configCsLIst = {
    method: 'put',
    url: 'https://'+MERCHANT+'.fulfil.io/api/v2/model/stock.shipment.out/search',
    headers: { 
      'x-api-key': API_KEY, 
      'Content-Type': 'text/plain'
    },
    data : dataConfigCsList
  };
  

// The await is necessary here. 
  await axios(configCsLIst)
  .then(function (response) {
    safeArray = response.data
  })
  .catch(function (error) {
    console.log(error);
  });


  // Format the results of the call to Results array logic. 
  while(safeArray.length>0){ // use chunk if this doesnt work. 
      resultArray.push(safeArray.splice(0,500));
  }//while

  

  // // forgot about foreach async snap . 
  
  // testing purposes 
  var validCsInformationArray = []
  var channelsCsArray = [];
  index1 = 0; 
  
  rateLogic = {
    pause: 1,
    interval: Date.now()
  }
// If a call fails I want it to try again. I do not have anything to stop it from repeatedly trying to make a call if it is just a bad request. 
  while (index1 < resultArray.length){
    if(rateLogic.pause<5){

      try{
      var data1  = JSON.stringify({
        "filters": [
          [
            "id",
            "in",
            resultArray[index1]
          ]
        ],
        "fields": [
          "id",
          "channels",
          "rec_name",
          "state",
          "sales"
        ]
      });
      
      // Had to modify. search_read has a 500 limit for shipment.out
      var configGetChannels = {
        method: 'put',
        url: 'https://'+MERCHANT+'.fulfil.io/api/v2/model/stock.shipment.out/search_read',
        headers: { 
          'x-api-key': API_KEY, 
          'Content-Type': 'text/plain', 
          'Access-Control-Allow-Origin': '*',
        },
        data : data1
      }; 

      rateLogic.pause = rateLogic.pause + 1;
      await axios(configGetChannels)
        .then(function async (response) {
          channelsCsArray.push(response.data)
          index1 = index1 +1; 
        })
        .catch(function (error) {
            console.log(error);
          });

      }catch(err){
           console.log(err); 
      }
    }
      else{
        pauseMe(rateLogic);
   //     console.log(rateLogic.interval+ " " + rateLogic.pause)
      }
    

  }// while 


  // Nesting for-Each caused problems. Thus, The first loop is still necessary. (no nested for-each.)
  var listOfCsToSplit = []
  index2 = 0; 
  while ( index2 < channelsCsArray.length){
    channelsCsArray[index2].forEach( element => {
      if (element.channels.length > 1){
        listOfCsToSplit.push(element.id)
        validCsInformationArray.push(element)
      }
    })
    index2 = index2 +1;
  }// while 

  console.log(validCsInformationArray)
  console.log(listOfCsToSplit)
  return listOfCsToSplit;

}


const functionEnter1 = async () =>{

    // Create necesary globals and get cs info.
    var LogObj = {
        goodCs : [],
        badCs : [],
        newCsMade : [],
        failedSplitCs : [],
    }

   
    var CsIdToSplit = [];
    CsIdToSplit = await retrieveCsList()
    
    //console.log(CsIdToSplit)
    var rateLogic = {
      pause: 0, 
      interval: Date.now()
    }
 
    var index1 = 0; 
    await delay(1000)

    // do I want to bubble up the exceptions here? I would want them to be specific if I want this to crash for some reason.
    while ( index1 < CsIdToSplit.length){
      try{
      await processOneCs(LogObj, rateLogic, CsIdToSplit[index1])
      } catch( error ){ // need more specific errors. 
        console.log( "There was an error processing "+ CsIdToSplit[index1])
        console.log(error);
      }
      index1 = index1 +1;
    }//while 

    //I am not sure how to make something like this persist if it is in a dynamic local environment (it would be deleted)

    // Put in a try catch for each because it is not allowed to crash here. // D
    await createWriteLogFiles('BadCsFolder','BadCs('+insertDate+').txt',LogObj.badCs)
    await createWriteLogFiles('GoodCsFolder','GoodCs('+insertDate+').txt',LogObj.goodCs)
    await createWriteLogFiles('NewCsFolder','NewCs('+insertDate+').txt',LogObj.newCsMade)
    await createWriteLogFiles('FailedSplitFolder','FailedSplitCs('+insertDate+').txt',LogObj.failedSplitCs)
 
}


// This is responsible for removing a channel from a CS. It will remove the first listed channel from the channel attr. 
//Clean up. 
const processOneCs = async (Logging1, rateLogic1, IDCS) => {

  var finalArray = [];
  var objectData = {
      CsId : IDCS, 
      channels: [], 
      plannedShip: '',
      lineItems: [],
      lineItemsHash : new Map(),
      // created second because of confusion. will need to fix. 
      movementArray: [],
      inventoryMoves: [],
      outgoingMoves: [],

      plannedDateIso: "", 
      plannedDay: "",
      plannedMonth: "", 
      plannedYear: ""
  }

  var salesOrders = [];
  var data1 = ''; 
  var config1 = {
    method: 'get',
    url: 'https://'+MERCHANT+'.fulfil.io/api/v2/model/stock.shipment.out/'+objectData.CsId,
    headers: { 
      'x-api-key': API_KEY, 
      'Cookie': 'session=eyJfcGVybWFuZW50Ijp0cnVlfQ.Y5oPDg.bvNBM2QfxknAMsJKRVz4uBJLGu4'
    },
    data : data1
  };

  rateLogic1.pause = rateLogic1.pause + 1;
  await axios(config1)
    .then(function (response) {
    salesOrders = response.data.sales
    objectData.channels = response.data.channels
    objectData.movementArray = response.data.moves
    objectData.inventoryMoves = response.data.inventory_moves
    objectData.outgoingMoves = response.data.out_moves

    objectData.plannedDateIso = response.data.planned_date.iso_string
    objectData.plannedDay = response.data.planned_date.day 
    objectData.plannedMonth = response.data.planned_date.month
    objectData.plannedYear = response.data.planned_date.year
  }).catch(function (error) {
    console.log(error);
    Logging1.badCs.push([objectData.CsId, error])

    // might need to use if else. 
    // Bubble the excecption and throw it out? 
    // return will not work. 
  });


  // Watch out for this. 
  
  var channelRemove = objectData.channels[1];



  // The following checks if the SO is associated with the Channel to spit. Returns relevent Line Items.
  var index1 = 0;
  var lineItemsToCheck = [];

  while(index1<salesOrders.length){
    if(rateLogic1.pause<5){
    var data2 = '';
    var config2 = {
      method: 'get',
      url: 'https://'+MERCHANT+'.fulfil.io/api/v2/model/sale.sale/'+salesOrders[index1],
      headers: { 
        'x-api-key': API_KEY, 
        'Cookie': 'session=eyJfcGVybWFuZW50Ijp0cnVlfQ.Y5oQIw.mNsOuq9FzFCYXHS0N4ClK7r6nho'
      },
      data : data2
    };

    rateLogic1.pause = rateLogic1.pause +1
    await axios(config2)
    .then(function (response) {
      if(response.data.channel == channelRemove){
        response.data.lines.forEach(element => {
          lineItemsToCheck.push(element)
        });
      }// if
        else{
          console.log( salesOrders[index1]+' Sales order is not in the channel')
      }
    })
    .catch(function (error) {
      console.log(error);
      Logging1.badCs.push([objectData.CsId, error])
      // Throw here, if I cannot check every sales order for the correct channel, I do want to try again if it is just a bad call. // if else statement
    });
    index1 = index1 + 1;
    }// if
    else{
        await pauseMe(rateLogic1)
        console.log(rateLogic1.interval+ " " + rateLogic1.pause)
    } 
  }// while 

//console.log("the line items to check are+ " +lineItemsToCheck)
  
  var index2 = 0; 
  while(index2 < lineItemsToCheck.length){
      objectData.lineItemsHash.set(lineItemsToCheck[index2].toString(), 2);
      index2 = index2 +1;
  }

  var index3 = 0;
  var finalArray = [];
  var finalArrayHash = new Map();
  while(index3 < objectData.movementArray.length){
    if(rateLogic1.pause < 5){
      var data4 = '';
      var config4 = {
        method: 'get',
        url: 'https://'+MERCHANT+'.fulfil.io/api/v2/model/stock.move/'+objectData.movementArray[index3],
        headers: { 
          'x-api-key': API_KEY, 
          'Cookie': 'session=eyJfcGVybWFuZW50Ijp0cnVlfQ.Y5oz_Q.OxxJQuxwUztsOPcTIYcLl9Mf6xE'
        },
        data : data4
      };

      rateLogic1.pause = rateLogic1.pause +1                                        
      await axios(config4)
      .then(function (response) {
        var temp1 = response.data.origin
        // There are many ways to do this.                                                                                                       

        var temp2 = temp1.replace('sale.line,', "").trim();
        if(objectData.lineItemsHash.has(temp2)){
          finalArray.push([response.data.id, response.data.quantity, response.data.rec_name, temp2, response.data.state])
          finalArrayHash.set(response.data.id.toString(), response.data.quantity)
        }
      })
      .catch(function (error) {
        console.log(error);
        Logging1.badCs.push([objectData.CsId, error])
      });
    
      index3 = index3 +1;
    }else{
      await pauseMe(rateLogic1)
      console.log(rateLogic1.interval+ " " + rateLogic1.pause)
    }//ifelse
  }//while


console.log("TheFinalArray is")
console.log(finalArray)
console.log(finalArrayHash)
  
/// I made a mistake and this is the hacky solution to it.     
var index6 = 0;
  var finalArray2 = [];
  while(index6 < objectData.inventoryMoves.length){
    if(rateLogic1.pause < 5){
      var data6 = '';
      var config6 = {
        method: 'get',
        url: 'https://'+MERCHANT+'.fulfil.io/api/v2/model/stock.move/'+objectData.inventoryMoves[index6],
        headers: { 
          'x-api-key': API_KEY, 
          'Cookie': 'session=eyJfcGVybWFuZW50Ijp0cnVlfQ.Y5oz_Q.OxxJQuxwUztsOPcTIYcLl9Mf6xE'
        },
        data : data6
      };

      rateLogic1.pause = rateLogic1.pause +1
      await axios(config6)
      .then(function (response) {
        var tempString1 = response.data.origin
        var tempString2 = tempString1.replace('stock.move,', "").trim();
        //console.log("temp string 2 is " + tempString2)
        if(finalArrayHash.has(tempString2)){
          finalArray2.push([response.data.id, response.data.quantity, response.data.rec_name, tempString2, response.data.state])
          //console.log("it pushed "+ response.data.id, response.data.state)


          /// May need to add logic here or below to test if the state is assigned and exit here if it is not. More info below. 
        }else{
          console.log("it did not push "+response.data.id)
        }
      })
      .catch(function (error) {
        console.log(error);
        Logging1.badCs.push([objectData.CsId, error])
      });
    
      index6 = index6 +1;
    }else{
      await pauseMe(rateLogic1)
      //console.log(rateLogic1.interval+ " " + rateLogic1.pause)
    }//ifelse
  }//while

// Need to modify logic. 


// swap to preserve final array and because I am lazy. I do not want to rewrite code 
var PreserveFinalArray1 = finalArray; 
finalArray = finalArray2
//console.log(finalArray)
//console.log("the final arra is" + finalArray)
  // #### may need to modify SendString with additional data. 

  // if the move item is not assigned , I need to stop. But, that would also mean a new cs will not have removed the channel if checked at this point.


  // ##### Logic to add "assigned" checking. 
//   if (finalArray[0][4] == "assigned"){
// /// 
//   }
//   else {
//     /// It will fail to seperate channel, Leave the function and move on to the next CS. 
//     // update logging object to reflect this. 
//   }
  var sendString = '[\r\n[{"id": '+finalArray[0][0]+', "quantity": '+finalArray[0][1]+'}';
  var index5 = 1;
    while (index5 < finalArray.length){
      sendString = sendString + ',\r\n{"id": '+finalArray[index5][0]+', "quantity": '+finalArray[index5][1]+'}'
      index5 = index5 + 1;
      /// #### May Need to add logic for if the inventory move is assigned or not. If it is, I will need to end execution and move on to the next CS. 

    }//while
  
  //sendString = sendString + ']\r\n' // If no date information is required. 


  // Date Information
  if(objectData.plannedDateIso !==""){
    sendString = sendString + '],\r\n'
  sendString = sendString + '{\r\n    "__class__": "date",\r\n'
  sendString = sendString + '     "year": '+objectData.plannedYear+',\r\n     "month": '+objectData.plannedMonth+',\r\n     "day": '+objectData.plannedDay+'\r\n}\r\n'    
  }
  else{
    sendString = sendString + ']\r\n'
  }

  sendString = sendString + ']'

  //console.log(sendString)
  var config5 = {
    method: 'put',
    url: 'https://'+MERCHANT+'.fulfil.io/api/v2/model/stock.shipment.out/'+IDCS+'/split',
    headers: { 
      'x-api-key': API_KEY, 
      'Content-Type': 'text/plain'
    },
    data : sendString
  }

  /// ###################################################### TESTING DO NOT DO THIS

//   await axios(config5)
//   .then(function (response) {
//     console.log(JSON.stringify(response.data));
//     Logging1.goodCs.push(objectData.CsId)
//     Logging1.newCsMade.push(response.data)
//     console.log("the return of the request of the split is "+response.data)

//   })
//   .catch(function (error) {
//     console.log(error);
//    Logging1.badCs.push([objectData.CsId, error])
//    consonle.log("The request to split failed")
//   });

// console.log(Logging1.newCsMade)


// Remove before testing. 
  // in last request /  call. 
 // Logging1.goodCs.push(objectData.CsId)
  //Logging1.newCsMade.push("tempCsNumberOutputId")

// Pause here. 
delay(1000);

// Validate Sucess
try{
  var data1  = JSON.stringify({
    "filters": [
      [
        "id",
        "=",
        IDCS
      ]
    ],
    "fields": [
      "id",
      "channels",
      "rec_name",
      "state"
    ]
  });

  var configGetChannels = {
    method: 'put',
    url: 'https://'+MERCHANT+'.fulfil.io/api/v2/model/stock.shipment.out/search_read',
    headers: { 
      'x-api-key': API_KEY, 
      'Content-Type': 'text/plain', 
      'Access-Control-Allow-Origin': '*',
    },
    data : data1
  }; 

  var newChannelsArray
  await axios(configGetChannels)
    .then(function async (response) {
      //console.log(JSON.stringify(response.data[0]));
      newChannelsArray = response.data[0].channels
    })
    .catch(function (error) {
        console.log(error);
        Logging1.badCs.push([objectData.CsId, error])
      });

  }catch(err){
       console.log(err); 
       Logging1.badCs.push([objectData.CsId, error])
  }
     var channelWasRemoved = true;
     // This really assumes that the whole process started with 2 channels
     if(newChannelsArray.length >1){
        await newChannelsArray.forEach(element => {
          console.log(element)
          if(element == channelRemove){
            channelWasRemoved = false; 
            Logging1.failedSplitCs.push(IDCS)
            console.log('The channel was not removed for' + IDCS)
          }
        })
     }
}



functionEnter1()
