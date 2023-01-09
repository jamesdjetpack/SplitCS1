# SplitCS1
This is the first draft of the split CS application.

1. You will need to add an .env file. 
  Within this file add: 
  
  
TEST_MERCHANT = 'jetpack-sandbox'
TEST_API_KEY = { Key }
REAL_MERCHANT = 'jetpackshipping'
REAL_API_KEY = {Key} 


2. You will need to add the following directories at the top level of the application structure. 

BadCsFolder
FailedSplitFolder
GoodCsFolder
NewCsFolder

These folders need to exist before execution. Please remove files within these folders before commiting to git. 


3. run  "npm install"
4. run "node index.js"

There is some information about
The current concern with this application is how current suggestions 

I have not been able to test this applicataion enough to confidently put into production.

I am not sure how adding logic to check if the state of an inventory move will affect the application. 

I do know that by the time the state of the inventory move is checked, The CS order should not be split. 
Spliting the Customer Shipment at that point will not remove the channel. This is the best case. If it was the only inventory move to split, it will likely send a request without anything to split. This will probably return an error. 

I would also like to add logic to filter CS better. 

For an example: What state should a CS be in for me to safely split it. 
Fulfil.io will merge shipments even if they are in a draft state. This is the same if the Sales Order associated with a Customer Shipment is in a draft state. 

This link has helpful information about the logic behind the code. 
https://docs.google.com/document/d/1XJ38r0K94E5KK1RGeIX1G0QTfzXvm-g0QHYmed25Qzs/edit?usp=sharing

