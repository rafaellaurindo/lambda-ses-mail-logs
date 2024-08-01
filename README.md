# Lambda SES Mail Logs

[![GitHub stars](https://img.shields.io/github/stars/rafaellaurindo/lambda-ses-mail-logs.svg)](Stars)
[![GitHub issues](https://img.shields.io/github/issues/rafaellaurindo/lambda-ses-mail-logs.svg)](Issues)
[![GitHub license](https://img.shields.io/github/license/rafaellaurindo/lambda-ses-mail-logs.svg)](MIT)

Lambda function to log SES emails sent through SNS to Cloudwatch.

## Usage

1. Set a Configuration Set on SES
2. Create a Topic on SNS and set the Configuration Set as the destination
3. Create a Lambda Function with the code in `index.mjs`
4. Subscribe the Lambda Function to the SNS Topic
5. Done!

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

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
