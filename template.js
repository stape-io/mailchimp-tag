const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getRemoteAddress = require('getRemoteAddress');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const sendHttpRequest = require('sendHttpRequest');

/*==============================================================================
==============================================================================*/

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = isLoggingEnabled ? getRequestHeader('trace-id') : undefined;
const eventData = getAllEventData();

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

let apiKeyData = data.apiKey.split('-');

if (!apiKeyData[1]) {
  data.gtmOnFailure();
} else {
  if (data.type === 'createOrUpdateContact' || data.type === 'createOrUpdateContactTrackEvent') {
    let url =
      'https://' +
      enc(apiKeyData[1]) +
      '.api.mailchimp.com/3.0/lists/' +
      enc(data.listId) +
      '/members/' +
      enc(data.emailHashed);
    let method = 'PUT';
    let bodyData = {
      email_address: data.email,
      status_if_new: 'subscribed',
      ip_signup: getRemoteAddress(),
      merge_fields: formatFields(data.mergeFields)
    };

    if (data.contactTags && data.contactTags.length) {
      bodyData.tags = formatTags(data.contactTags);
    }

    if (isLoggingEnabled) {
      logToConsole(
        JSON.stringify({
          Name: 'MailChimp',
          Type: 'Request',
          TraceId: traceId,
          EventName: 'CreateOrUpdateContact',
          RequestMethod: method,
          RequestUrl: url,
          RequestBody: bodyData
        })
      );
    }

    sendHttpRequest(
      url,
      (statusCode, headers, body) => {
        if (isLoggingEnabled) {
          logToConsole(
            JSON.stringify({
              Name: 'MailChimp',
              Type: 'Response',
              TraceId: traceId,
              EventName: 'CreateOrUpdateContact',
              ResponseStatusCode: statusCode,
              ResponseHeaders: headers,
              ResponseBody: body
            })
          );
        }
        if (statusCode >= 200 && statusCode < 300) {
          if (data.type === 'createOrUpdateContactTrackEvent') {
            sendEventRequest();
          } else {
            data.gtmOnSuccess();
          }
        } else {
          data.gtmOnFailure();
        }
      },
      { headers: { Authorization: 'Bearer ' + data.apiKey }, method: method, timeout: 3500 },
      JSON.stringify(bodyData)
    );
  } else {
    sendEventRequest();
  }
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function sendEventRequest() {
  let url =
    'https://' +
    enc(apiKeyData[1]) +
    '.api.mailchimp.com/3.0/lists/' +
    enc(data.listId) +
    '/members/' +
    enc(data.emailHashed) +
    '/events';
  let method = 'POST';
  let bodyData = {
    name: data.eventName,
    properties: formatFields(data.eventProperties)
  };

  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'MailChimp',
        Type: 'Request',
        TraceId: traceId,
        EventName: data.eventName,
        RequestMethod: method,
        RequestUrl: url,
        RequestBody: bodyData
      })
    );
  }

  sendHttpRequest(
    url,
    (statusCode, headers, body) => {
      if (isLoggingEnabled) {
        logToConsole(
          JSON.stringify({
            Name: 'MailChimp',
            Type: 'Response',
            TraceId: traceId,
            EventName: data.eventName,
            ResponseStatusCode: statusCode,
            ResponseHeaders: headers,
            ResponseBody: body
          })
        );
      }
      if (statusCode >= 200 && statusCode < 300) {
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    },
    { headers: { Authorization: 'Bearer ' + data.apiKey }, method: method, timeout: 3500 },
    JSON.stringify(bodyData)
  );
}

function formatFields(mergeFields) {
  let mergeFieldsResult = {};

  for (let mergeFieldsKey in mergeFields) {
    mergeFieldsResult[mergeFields[mergeFieldsKey].field] = mergeFields[mergeFieldsKey].value;
  }

  return mergeFieldsResult;
}

function formatTags(tags) {
  let tagsResult = [];

  for (let tagsKey in tags) {
    tagsResult.push(tags[tagsKey].name);
  }

  return tagsResult;
}

/*==============================================================================
Helpers
==============================================================================*/

function enc(data) {
  if (['null', 'undefined'].indexOf(getType(data)) !== -1) data = '';
  return encodeUriComponent(makeString(data));
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}
