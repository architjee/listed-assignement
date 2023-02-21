const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://mail.google.com/'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.labels.list({
        userId: 'me',
    });
    const labels = res.data.labels;
    if (!labels || labels.length === 0) {
        console.log('No labels found.');
        return;
    }
    console.log('Labels:');
    labels.forEach((label) => {
        console.log(`- ${label.name}`);
    });
}
async function autoReplySyncher(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({
        userId: 'me',
    });
    let messages = (res.data.messages);
    messages.forEach(message => {
        gmail.users.messages.get({ auth: auth, userId: 'me', id: message.id }, callbackForEachMessage)
        gmail.users.messages.modify({auth: auth, userId: 'me', id: message.id,requestBody:{ addLabelIds:['Label_62705540091235948'],"removeLabelIds": [
            'UNREAD'
          ]} })
    })
    function handleReply(toParty, threadId){
        console.log('Handling reply to ', toParty ,'@ following threadId', threadId)
        console.log(Buffer.from(genereateRawMessage(toParty)).toString('base64') )

        try {
            gmail.users.messages.send({auth: auth, userId: 'me', requestBody:{
                raw: Buffer.from(genereateRawMessage(toParty)).toString('base64') }})
        } catch (error) {
            
        }
       
    }
    function callbackForEachMessage(err, res) {
        if (!err) {
            let message = res.data;
            message.labelIds.forEach(label => {
                if (label == 'UNREAD' && message.labelIds.indexOf('INBOX') > -1) {
                    // console.log('This is the unread email')
                    if (message.id == message.threadId) {
                        // console.log('This is a single email message')
                        let headers = message.payload.headers;
                        headers.forEach(header => {
                            if (header.name == "From") {
                                // console.log(header.value, message.threadId)
                                const toParty = header.value;
                                const threadId = message.threadId;
                                handleReply(toParty, threadId)
                            }
                        })
                    }
                }
            })

        }
    }
}

setInterval(main, 9000);
function main() {
    authorize().then(autoReplySyncher).catch(console.error);
    console.log('Syncher running.')
}
function genereateRawMessage(toSender){
    let messageBody = `From: Archit Jain <architjee@gmail.com> 
To: ${toSender} 
Subject: Out of office 
Date: Tue, 21 Feb 2023 09:55:06 -0600 
Message-ID: <1234@local.machine.example>

The author is out of office.`
    return messageBody
}