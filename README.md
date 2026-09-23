# Lambda SES Mail Logs

[![GitHub stars](https://img.shields.io/github/stars/rafaellaurindo/lambda-ses-mail-logs.svg)](https://github.com/rafaellaurindo/lambda-ses-mail-logs/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/rafaellaurindo/lambda-ses-mail-logs.svg)](https://github.com/rafaellaurindo/lambda-ses-mail-logs/issues)
![GitHub License](https://img.shields.io/github/license/rafaellaurindo/lambda-ses-mail-logs)

Lambda function that logs [Amazon SES email sending events](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html), delivered through SNS, to CloudWatch as structured JSON.

## Usage

1. Create an SNS topic.
2. In SES, create a **Configuration Set** and add an **event destination** of type Amazon SNS pointing to the topic. Select the event types you want to log.
3. Create a Lambda function (Node.js 22.x or later) with the code in `index.mjs`. The default execution role (`AWSLambdaBasicExecutionRole`) is enough.
4. Subscribe the Lambda function to the SNS topic.
5. Send email using the configuration set (e.g. the `ConfigurationSetName` parameter or the `X-SES-CONFIGURATION-SET` header).

SES notifications configured directly on an identity (which use `notificationType` instead of `eventType`) are also supported.

## Supported events

| SES event | Logged `type` |
| --- | --- |
| Send | `SEND` |
| Delivery | `DELIVERY` |
| DeliveryDelay | `DELIVERY_DELAY` |
| Bounce | `BOUNCE` |
| Complaint | `COMPLAINT` |
| Reject | `REJECT` |
| Rendering Failure | `RENDERING_FAILURE` |
| Open | `OPEN` |
| Click | `CLICK` |
| Subscription | `SUBSCRIPTION` |

## Log format

Each event is written as a single JSON line with common mail fields plus event-specific fields:

```json
{
  "type": "BOUNCE",
  "feedbackId": "0100017...",
  "messageId": "0100017...",
  "destination": "user@example.com",
  "destinations": ["user@example.com"],
  "fromName": "Acme",
  "fromEmail": "no-reply@acme.com",
  "subject": "Welcome",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "sendingAccountId": "123456789012",
  "mailTags": { "env": "prod" },
  "result": "FAILURE",
  "bounceType": "Permanent",
  "bounceSubType": "General",
  "bouncedRecipients": [{ "emailAddress": "user@example.com", "status": "5.1.1" }],
  "snsMessageId": "..."
}
```

Malformed or unknown messages are logged as `INVALID_RECORD`, `UNKNOWN_EVENT` or `PROCESSING_ERROR` instead of failing the invocation, so SNS never retries them and no logs are duplicated.

### Querying with CloudWatch Logs Insights

```
fields @timestamp, type, destination, subject, result
| filter type in ["BOUNCE", "COMPLAINT"]
| sort @timestamp desc
```

This works with Lambda's default **Text** log format, where Insights discovers the fields of the JSON in each line. If the function uses the **JSON** log format, the event is stored as a string in `message`; access fields with `jsonParse(message).type` instead.

## Services Used

- [AWS Lambda](https://aws.amazon.com/lambda/)
- [AWS SES](https://aws.amazon.com/ses/)
- [AWS SNS](https://aws.amazon.com/sns/)
- [AWS Cloudwatch](https://aws.amazon.com/cloudwatch/)

## Contributing

1. Fork this repository and clone it to your local machine.
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
