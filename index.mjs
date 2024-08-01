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

const handleDeliveryDelayEvent = (rawMessage) => {
  const { mail, deliveryDelay } = rawMessage;

  const { expirationTime, delayType } = deliveryDelay;

  console.log({
    type: "DELIVERY_DELAY",
    ...getMailData(mail),
    result: "FAILURE",
    expirationTime,
    delayType,
  });
};

const handleBounceEvent = (rawMessage) => {
  const { mail, bounce } = rawMessage;

  const { feedbackId, bounceType, bounceSubType, reportingMTA } = bounce;

  console.log({
    type: "BOUNCE",
    feedbackId,
    ...getMailData(mail),
    result: "FAILURE",
    bounceType,
    bounceSubType,
    reportingMTA,
  });
};

export const handler = async (event) => {
  const snsEventData = JSON.parse(event.Records[0].Sns.Message);

  const { eventType } = snsEventData;

  const handler = {
    Send: handleSendEvent,
    Delivery: handleDeliveryEvent,
    DeliveryDelay: handleDeliveryDelayEvent,
    Bounce: handleBounceEvent,
  }[eventType];

  if (!handler) {
    console.error("Unknown notification type", { snsEventData });
    return;
  }

  try {
    handler(snsEventData);
    const response = {
      statusCode: 200,
      body: JSON.stringify({ message: "Success" }),
    };

    return response;
  } catch (error) {
    console.error("Error", { error });

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error" }),
    };
  }
};
