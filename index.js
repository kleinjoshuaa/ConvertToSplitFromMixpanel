const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const { ungzip } = require("node-gzip");
const https = require("follow-redirects").https;

const batchSize = process.env.BATCH_SIZE;
const numRetries = process.env.NUM_RETRIES;
const environment = process.env.ENVIRONMENT;
const sleepMs = process.env.SLEEP_MS;
const apiKey = process.env.API_KEY;


const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

let sampleEvent = {  
  "Records":[  
     {  
        "eventVersion":"2.2",
        "eventSource":"aws:s3",
        "awsRegion":"us-east-2",
        "eventTime":"1970-01-01T00:00:00.000Z",
        "eventName":"event-type",
        "userIdentity":{  
           "principalId":"joshKlein"
        },
        "requestParameters":{  
           "sourceIPAddress":"192.168.1.1"
        },
        "responseElements":{  
           "x-amz-request-id":"Amazon S3 generated request ID",
           "x-amz-id-2":"Amazon S3 host that processed the request"
        },
        "s3":{  
           "s3SchemaVersion":"1.0",
           "configurationId":"ID found in the bucket notification configuration",
           "bucket":{  
              "name":"mixpanel-to-split",
              "ownerIdentity":{  
                 "principalId":"Amazon-customer-ID-of-the-bucket-owner"
              },
              "arn":"arn:aws:s3:::mixpanel-to-split"
           },
           "object":{  
              "key":"2695663/2022/04/18/full_day/complete",
              "size":"object-size in bytes",
              "eTag":"object eTag",
              "versionId":"object version if bucket is versioning-enabled, otherwise null",
              "sequencer": "a string representation of a hexadecimal value used to determine event sequence, only used with PUTs and DELETEs"
           }
        },
        "glacierEventData": {
           "restoreEventData": {
              "lifecycleRestorationExpiryTime": "The time, in ISO-8601 format, for example, 1970-01-01T00:00:00.000Z, of Restore Expiry",
              "lifecycleRestoreStorageClass": "Source storage class for restore"
           }
        }
     }
  ]
}



function createRequestOptions() {
  let options = {
    method: "POST",
    hostname: "events.split.io",
    path: "/api/events/bulk",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    maxRedirects: 20,
  };
  return options;
}



function formatMixPanelEvent(mixPanelEvent) {
  let result = {
    eventTypeId: mixPanelEvent.event,
    environmentName: environment,
    trafficTypeName: "user",
    key: mixPanelEvent.properties.distinct_id,
    timestamp: mixPanelEvent.properties.time * 1000,
    value: 0,
    properties: mixPanelEvent.properties,
  };

  return result;
}



async function sendHTTPEvents(options, events, retryCount){
  let req = https.request(options, function (res) {
    let chunks = [];
    if(res.statusCode != 202) {
      console.error("Status Code: "+res.statusCode+" the events were not imported");
      if(retryCount == numRetries){
        console.error('try '+retryCount+' failed, will not retry')
      } else {
        retryCount++
        sleep(sleepMs)
        console.error('Retry number '+retryCount)
        sendHTTPEvents(options, events, retryCount)
      }
    } else {
      console.log('success')
    }
    res.on("data", function (chunk) {
      chunks.push(chunk);
    });
  
    res.on("end", function (chunk) {
      var body = Buffer.concat(chunks);
    });
    
    res.on("error", function (error) {
      console.error(error);
      if(retryCount == numRetries){
        console.error(retryCount+' try failed, will not retry')
      } else {
        retryCount++
        sleep(sleepMs)
        console.error('Retry number '+retryCount)
        sendHTTPEvents(options, events, retryCount)
      }
    });
  });
  req.write(JSON.stringify(events));
  req.end();

}

exports.handler = async (event, context) => {
  const Bucket = event.Records[0].s3.bucket.name;
  const Key = decodeURIComponent(
   event.Records[0].s3.object.key
    .replace(/\+/g, " ")
     .replace("complete", "export.json.gz")
  );
  const data = await s3.getObject({ Bucket, Key }).promise();

  const json = (await ungzip(data.Body)).toString().split("\n").slice(0, -1);
  let options = createRequestOptions();

  for(let jsonIdx = 0; jsonIdx < json.length; jsonIdx += batchSize) {
    let batchData = [];
    for(let batchIdx = jsonIdx; batchIdx < Math.min(jsonIdx+batchSize, json.length); batchIdx+=1) {
      batchData.push(formatMixPanelEvent(JSON.parse(json[batchIdx])));
    }
    await sendHTTPEvents(options, batchData, 0);
    sleep(sleepMs)
  }

};
