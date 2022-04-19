const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const { ungzip } = require("node-gzip");
const axios = require("axios");

const batchSize = process.env.BATCH_SIZE;
const numRetries = process.env.NUM_RETRIES;
const environment = process.env.ENVIRONMENT;
const sleepMs = process.env.SLEEP_MS;
const apiKey = process.env.API_KEY;

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

function createRequestOptions() {
  let options = {
    method: "POST",
    url: "https://events.split.io/api/events/bulk",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
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

async function sendHTTPEvents(options, events, retryCount) {
  options.data = events;
  await axios(options)
    .then(async function (response) {
      if (response.status != 202) {
        console.error(
          "Status Code: " + response.status + " the events were not imported"
        );
        if (retryCount == numRetries) {
          console.error("try " + retryCount + " failed, will not retry");
        } else {
          retryCount++;
          sleep(sleepMs);
          console.error("Retry number " + retryCount);
          await sendHTTPEvents(options, events, retryCount);
        }
      } else {
        console.log("success");
      }
    })
    .catch(async function (error) {
      console.log(error);
      console.error("The events were not imported");
      if (retryCount == numRetries) {
        console.error("try " + retryCount + " failed, will not retry");
      } else {
        retryCount++;
        sleep(sleepMs);
        console.error("Retry number " + retryCount);
        await sendHTTPEvents(options, events, retryCount);
      }
    });
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

  for (let jsonIdx = 0; jsonIdx < json.length; jsonIdx += batchSize) {
    let batchData = [];
    for (
      let batchIdx = jsonIdx;
      batchIdx < Math.min(jsonIdx + batchSize, json.length);
      batchIdx += 1
    ) {
      batchData.push(formatMixPanelEvent(JSON.parse(json[batchIdx])));
    }
    await sendHTTPEvents(options, batchData, 0);
    sleep(sleepMs);
  }
};
