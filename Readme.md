# SendSplitToMixpanel

The provided code is a lambda function that can be uploaded and used as a way to send mixpanel events to split

It reads 2 environment variables. process.env.ENVIRONMENT for the name of the split environment, and process.env.API_KEY for the split api key. 

This uses the [Create Event](https://docs.split.io/reference/create-event) Split REST API. 


It needs to be run with a lambda function that has access rights to read the S3 bucket used as a raw data pipeline, as set up following this [Mixpanel documentation](https://developer.mixpanel.com/docs/aws-raw-pipeline)

Then you will need to set up the S3 bucket to create an event notification that triggers this Lambda function. This can be configured in the bucket properties.