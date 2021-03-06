const getRemoteAddress = require('getRemoteAddress');
const sendHttpRequest = require('sendHttpRequest');
const encodeUriComponent = require('encodeUriComponent');
const JSON = require('JSON');

const logToConsole = require('logToConsole');
const getContainerVersion = require('getContainerVersion');
const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;

let apiKeyData = data.apiKey.split('-');

if (!apiKeyData[1]) {
  data.gtmOnFailure();
} else {
  if (data.type === 'createOrUpdateContact' || data.type === 'createOrUpdateContactTrackEvent') {
    let url = 'https://' + encodeUriComponent(apiKeyData[1]) + '.api.mailchimp.com/3.0/lists/' + encodeUriComponent(data.listId) + '/members/'+ encodeUriComponent(data.emailHashed);

    let bodyData = {
      "email_address": data.email,
      "status_if_new": 'subscribed',
      "ip_signup": getRemoteAddress(),
      "merge_fields": formatFields(data.mergeFields)
    };

    if (data.contactTags && data.contactTags.length) {
      bodyData.tags = formatTags(data.contactTags);
    }

    if (isDebug) {
      logToConsole('Mailchimp createOrUpdateContact data: ', bodyData);
    }

    sendHttpRequest(url, (statusCode, headers, body) => {
      if (statusCode >= 200 && statusCode < 300) {
        if (data.type === 'createOrUpdateContactTrackEvent') {
          sendEventRequest();
        } else {
          data.gtmOnSuccess();
        }
      } else {
        data.gtmOnFailure();
      }
    }, {headers: {'Authorization': 'Bearer '+data.apiKey}, method: 'PUT', timeout: 3500}, JSON.stringify(bodyData));
  } else {
    sendEventRequest();
  }
}

function sendEventRequest()
{
  let url = 'https://' + encodeUriComponent(apiKeyData[1]) + '.api.mailchimp.com/3.0/lists/' + encodeUriComponent(data.listId) + '/members/' + encodeUriComponent(data.emailHashed) + '/events';

  let bodyData = {
    "name": data.eventName,
    "properties": formatFields(data.eventProperties)
  };

  if (isDebug) {
    logToConsole('Mailchimp trackEvent data: ', bodyData);
  }

  sendHttpRequest(url, (statusCode, headers, body) => {
    if (statusCode >= 200 && statusCode < 300) {
      data.gtmOnSuccess();
    } else {
      data.gtmOnFailure();
    }
  }, {headers: {'Authorization': 'Bearer '+data.apiKey}, method: 'POST', timeout: 3500}, JSON.stringify(bodyData));
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
