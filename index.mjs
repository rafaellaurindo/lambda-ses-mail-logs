const getMailData = (mail) => {
  const destination = mail.destination[0];
  const { timestamp, tags: mailTags } = mail;

  Object.keys(mailTags).forEach(tag => mailTags[tag] = mailTags[tag].join(','))

  let [fromName, fromEmail] = mail.source.split("<");

  fromName = fromName.replace(/"/g, "").trim();
  fromEmail = fromEmail.replace(">", "").trim();

  const subject = mail.commonHeaders.subject;

  return {
    messageId: mail.messageId,
    destination,
    fromName,
    fromEmail,
    subject,
    timestamp,
    mailTags,
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

const handleOpenEvent = (rawMessage) => {
  const { mail, open: openData } = rawMessage;

  const { timestamp: openedAt, ipAddress, userAgent } = openData;

  console.log({
    type: "OPEN",
    ...getMailData(mail),
    openedAt,
    ipAddress,
    userAgent,
  });
};

const handleClickEvent = (rawMessage) => {
  const { mail, click: clickData } = rawMessage;

  const { timestamp: clickedAt, ipAddress, userAgent, link, linkTags } = clickData;

  console.log({
    type: "CLICK",
    ...getMailData(mail),
    clickedAt,
    ipAddress,
    userAgent,
    link,
    linkTags,
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
    Open: handleOpenEvent,
    Click: handleClickEvent,
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
