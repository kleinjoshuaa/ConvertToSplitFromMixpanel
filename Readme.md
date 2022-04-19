# SendMixpanelToSplit

The provided code is a lambda function that can be uploaded and used as a way to send mixpanel events to split

It reads 5 lambda environment variables. 
 - ENVIRONMENT for the name of the split environment
 - API_KEY for the split api key
 - BATCH_SIZE for the batch size to send events to Split
 - RETRY_COUNT for the number of retry attempts upon api call failure 
 - SLEEP_MS for the sleep time between retrys and batch sizes in milliseconds

This uses the [Create Events](https://docs.split.io/reference/create-events) Split REST API. 


It needs to be run with a lambda function that has access rights to read the S3 bucket used as a raw data pipeline, as set up following this [Mixpanel documentation](https://developer.mixpanel.com/docs/aws-raw-pipeline)

Then you will need to set up the S3 bucket to create an event notification that triggers this Lambda function. This can be configured in the bucket properties.

The Lambda function will determine which bucket and key to process from the S3 event supplied to it. 

To install and use:
1. Create a new S3 bucket
2. Setup the raw aws pipeline to use that bucket as per the [Mixpanel documentation](https://developer.mixpanel.com/docs/aws-raw-pipeline)
2. Create a new Lambda Function
3. Add a trigger so that when new files are added to the S3 bucket (all object creates) that it triggers the lambda function
4. Set up the environment variables for the lambda function under Configuration -> Environment variables
5. Ensure that the role used by the lambda function has access to the S3 bucket