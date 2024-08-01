const getMailData = (mail) => {
  const destination = mail.destination[0];
  const { timestamp } = mail;

  let [fromName, fromEmail] = mail.source.split("<");

  fromName = fromName.replace(/"/g, "").trim();
  fromEmail = fromEmail.replace(">", "").trim();

  const subject = mail.commonHeaders.subject;

  return {
    destination,
    fromName,
    fromEmail,
    subject,
    timestamp,
  };
};

const handleSendEvent = (rawMessage) => {
  const { mail } = rawMessage;

  console.log({
    type: "SEND",
    ...getMailData(mail),
  });
};

const handleDeliveryEvent = (rawMessage) => {
  const { mail, delivery } = rawMessage;

  const { processingTimeMillis, smtpResponse } = delivery;

  console.log({
    type: "DELIVERY",
    ...getMailData(mail),
    processingTimeMillis,
    result: delivery.smtpResponse.includes("250") ? "SUCCESS" : "FAILURE",
    smtpResponse,
  });
};

export const handler = async (event) => {
  const snsEventData = JSON.parse(event.Records[0].Sns.Message);

  switch (snsEventData.eventType) {
    case "Send":
      handleSendEvent(snsEventData);
      break;
    case "Delivery":
      handleDeliveryEvent(snsEventData);
      break;
    default:
      console.log("Unknown notification type", { snsEventData });
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify({ message: "Success" }),
  };

  return response;
};
