// Event record reference:
// https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html

// Logs are emitted as single-line JSON so CloudWatch Logs Insights can discover
// fields and nested arrays aren't truncated by util.inspect.
const log = (level, data) => {
  let line;

  try {
    line = JSON.stringify(data);
  } catch (error) {
    line = JSON.stringify({ type: "LOG_SERIALIZATION_ERROR", error: String(error) });
  }

  console[level](line);
};

const serializeError = (error) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };

// Accepts `"Name" <email>`, `Name <email>` or a bare `email`.
const parseAddress = (address) => {
  if (typeof address !== "string" || !address.trim()) {
    return { fromName: null, fromEmail: null };
  }

  const match = address.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);

  if (!match) {
    return { fromName: null, fromEmail: address.trim() };
  }

  const fromName = match[1].replace(/^"|"$/g, "").trim();

  return { fromName: fromName || null, fromEmail: match[2].trim() };
};

// SES sends tags as `{ key: [values] }`; flatten each list to a comma-separated string.
const normalizeTags = (tags) => {
  if (!tags || typeof tags !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(tags).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(",") : String(value),
    ])
  );
};

const getMailData = (mail = {}) => {
  const destinations = Array.isArray(mail.destination) ? mail.destination : [];

  return {
    messageId: mail.messageId ?? null,
    destination: destinations[0] ?? null,
    destinations,
    ...parseAddress(mail.source),
    subject: mail.commonHeaders?.subject ?? null,
    timestamp: mail.timestamp ?? null,
    sendingAccountId: mail.sendingAccountId ?? null,
    mailTags: normalizeTags(mail.tags),
  };
};

const handleSendEvent = ({ mail }) => ({
  type: "SEND",
  ...getMailData(mail),
});

// A Delivery event means the recipient's mail server accepted the message.
const handleDeliveryEvent = ({ mail, delivery = {} }) => ({
  type: "DELIVERY",
  ...getMailData(mail),
  result: "SUCCESS",
  deliveredAt: delivery.timestamp,
  processingTimeMillis: delivery.processingTimeMillis,
  recipients: delivery.recipients,
  smtpResponse: delivery.smtpResponse,
  reportingMTA: delivery.reportingMTA,
  remoteMtaIp: delivery.remoteMtaIp,
});

const handleDeliveryDelayEvent = ({ mail, deliveryDelay = {} }) => ({
  type: "DELIVERY_DELAY",
  ...getMailData(mail),
  result: "FAILURE",
  delayedAt: deliveryDelay.timestamp,
  expirationTime: deliveryDelay.expirationTime,
  delayType: deliveryDelay.delayType,
  delayedRecipients: deliveryDelay.delayedRecipients,
  reportingMTA: deliveryDelay.reportingMTA,
});

const handleBounceEvent = ({ mail, bounce = {} }) => ({
  type: "BOUNCE",
  feedbackId: bounce.feedbackId,
  ...getMailData(mail),
  result: "FAILURE",
  bouncedAt: bounce.timestamp,
  bounceType: bounce.bounceType,
  bounceSubType: bounce.bounceSubType,
  bouncedRecipients: bounce.bouncedRecipients,
  reportingMTA: bounce.reportingMTA,
});

const handleComplaintEvent = ({ mail, complaint = {} }) => ({
  type: "COMPLAINT",
  feedbackId: complaint.feedbackId,
  ...getMailData(mail),
  result: "FAILURE",
  complainedAt: complaint.timestamp,
  complaintSubType: complaint.complaintSubType ?? null,
  complaintFeedbackType: complaint.complaintFeedbackType,
  complainedRecipients: complaint.complainedRecipients,
  userAgent: complaint.userAgent,
  arrivalDate: complaint.arrivalDate,
});

const handleRejectEvent = ({ mail, reject = {} }) => ({
  type: "REJECT",
  ...getMailData(mail),
  result: "FAILURE",
  reason: reject.reason,
});

const handleRenderingFailureEvent = ({ mail, failure = {} }) => ({
  type: "RENDERING_FAILURE",
  ...getMailData(mail),
  result: "FAILURE",
  templateName: failure.templateName,
  errorMessage: failure.errorMessage,
});

const handleOpenEvent = ({ mail, open = {} }) => ({
  type: "OPEN",
  ...getMailData(mail),
  openedAt: open.timestamp,
  ipAddress: open.ipAddress,
  userAgent: open.userAgent,
  isBotEvent: open.isBotEvent,
});

const handleClickEvent = ({ mail, click = {} }) => ({
  type: "CLICK",
  ...getMailData(mail),
  clickedAt: click.timestamp,
  ipAddress: click.ipAddress,
  userAgent: click.userAgent,
  link: click.link,
  linkTags: click.linkTags,
  isBotEvent: click.isBotEvent,
});

const handleSubscriptionEvent = ({ mail, subscription = {} }) => ({
  type: "SUBSCRIPTION",
  ...getMailData(mail),
  subscribedAt: subscription.timestamp,
  contactList: subscription.contactList,
  source: subscription.source,
  newTopicPreferences: subscription.newTopicPreferences,
  oldTopicPreferences: subscription.oldTopicPreferences,
});

const eventHandlers = {
  Send: handleSendEvent,
  Delivery: handleDeliveryEvent,
  DeliveryDelay: handleDeliveryDelayEvent,
  Bounce: handleBounceEvent,
  Complaint: handleComplaintEvent,
  Reject: handleRejectEvent,
  "Rendering Failure": handleRenderingFailureEvent,
  Open: handleOpenEvent,
  Click: handleClickEvent,
  Subscription: handleSubscriptionEvent,
};

const processRecord = (record) => {
  const snsMessageId = record?.Sns?.MessageId ?? null;
  const rawMessage = record?.Sns?.Message;

  if (typeof rawMessage !== "string") {
    log("warn", { type: "INVALID_RECORD", snsMessageId, reason: "Missing Sns.Message" });
    return false;
  }

  const message = JSON.parse(rawMessage);

  // `notificationType` is used when SES notifications are configured on the
  // identity instead of via a configuration set event destination.
  const eventType = message?.eventType ?? message?.notificationType;

  if (eventType === "AmazonSnsSubscriptionSucceeded") {
    log("info", { type: "SNS_SUBSCRIPTION_SUCCEEDED", snsMessageId });
    return true;
  }

  const handleEvent = eventHandlers[eventType];

  if (!handleEvent) {
    log("warn", { type: "UNKNOWN_EVENT", snsMessageId, eventType, message });
    return false;
  }

  log("log", { ...handleEvent(message), snsMessageId });
  return true;
};

// SNS invokes Lambda asynchronously, so throwing would only trigger retries that
// duplicate logs for payloads that can never succeed. Errors are logged per record
// instead, and the invocation always completes.
export const handler = async (event) => {
  const records = Array.isArray(event?.Records) ? event.Records : [];
  let processed = 0;
  let failed = 0;

  if (records.length === 0) {
    log("warn", { type: "EMPTY_EVENT", event });
  }

  for (const record of records) {
    try {
      if (processRecord(record)) {
        processed++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      log("error", {
        type: "PROCESSING_ERROR",
        snsMessageId: record?.Sns?.MessageId ?? null,
        error: serializeError(error),
        rawMessage: record?.Sns?.Message,
      });
    }
  }

  return { processed, failed };
};
