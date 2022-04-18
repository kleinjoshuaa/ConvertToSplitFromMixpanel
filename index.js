const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const { ungzip } = require("node-gzip");
var https = require("follow-redirects").https;
var fs = require("fs");

// set API key variables

function createRequestOptions() {
  var options = {
    method: "POST",
    hostname: "events.split.io",
    path: "/api/events/bulk",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.API_KEY,
    },
    maxRedirects: 20,
  };
  return options;
}



function formatMixPanelEvent(mixPanelEvent) {
  let result = {
    eventTypeId: mixPanelEvent.event,
    environmentName: process.env.ENVIRONMENT,
    trafficTypeName: "user",
    key: mixPanelEvent.properties.distinct_id,
    timestamp: mixPanelEvent.properties.time * 1000,
    value: 0,
    properties: mixPanelEvent.properties,
  };

  return result;
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
//   let body = formatMixPanelEvent(JSON.parse(v));
  let options = createRequestOptions(body);
  var req = https.request(options, function (res) {
    var chunks = [];
    let data = [];
    json.forEach(function (v, i, a) {
        // add each event
        data.push(formatMixPanelEvent(JSON.parse(v)))    
    });
    res.on("data", function (chunk) {
        chunks.push(chunk);
      });

      res.on("end", function (chunk) {
        var body = Buffer.concat(chunks);
        console.log(body.toString());
      });

      res.on("error", function (error) {
        console.error(error);
      });
    });

    //console.log(JSON.stringify(body));
    req.write(JSON.stringify(body));

    req.end();

};
