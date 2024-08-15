import wppconnect from '@wppconnect-team/wppconnect';
import { MongoClient } from 'mongodb';
import axios from 'axios';

const OPENAI_API_KEY = '';

async function sendMessageToChatGPT(message) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/engines/gpt-3.5-turbo/completions',
        {
          prompt: message,
          max_tokens: 100,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );

      return response.data.choices[0].text.trim();
    } catch (error) {
      console.error('Error sending message to ChatGPT:', error.message);
      throw error;
    }
}

async function startWPP (){
    await wppconnect.create({session: 'gigachat',
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {},
        statusFind: (statusSession, session) => {
            console.log('Status Session: ', statusSession);
            console.log('Session name: ', session);
        },
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: true,
        browserWS: '',
        browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--headless'],
        puppeteerOptions: {},
        disableWelcome: true,
        updatesLog: false,
        autoClose: 60000,
        tokenStore: 'file',
        folderNameToken: './tokens',
    }).then((client) => {
        start(client);
    }).catch((erro) => console.log(erro));
}

async function start(client) {
    let parentMessageId, conversationId;

    const uri = 'mongodb+srv://saharshpandey2138:Makeitsimple1@cluster0.meg4cbc.mongodb.net/?retryWrites=true&w=majority';
    const dbclient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
      await dbclient.connect();
      const collection = dbclient.db('test').collection('conversations');

      client.onMessage(async (message) => {
        console.log(message.content);
        console.log(message.type);

        if (message.type === 'chat') {
          await client.sendSeen(message.from);

          if (message.content.toLowerCase() === 'hi') {
            await client.sendText(message.from, "Hey There!\nJust type anything & get along!\nType 'Reset' to reset the conversation", {
              quotedMsg: message.id,
            });
          } else if (message.content.toLowerCase() === 'reset') {
            const filter = { sender: message.from };
            const doc = await collection.findOne(filter);

            if (doc) {
              await collection.deleteOne(filter);
              await client.sendText(message.from, "Your details have been reset.", {
                quotedMsg: message.id,
              });
            } else {
              await client.sendText(message.from, "You have no details to reset.", {
                quotedMsg: message.id,
              });
            }
          } else {
            await client.startTyping(message.from);

            let storedConversation = await collection.findOne({ sender: message.from });
            let res;

            if (!storedConversation) {
              res = await sendMessageToChatGPT(message.content);
              await collection.insertOne({
                sender: message.from,
                parentMessageId: res.parentMessageId,
                conversationId: res.conversationId,
              });
            } else {
              res = await sendMessageToChatGPT(message.content, {
                conversationId: storedConversation.conversationId,
                parentMessageId: storedConversation.parentMessageId,
              });
            }

            console.log(res);
            await client.stopTyping(message.from);

            await client.sendText(message.from, res, {
              quotedMsg: message.id,
            });
          }
        }
      });
    } catch (error) {
      console.error('Error connecting to MongoDB:', error.message);
    } finally {
      await dbclient.close();
    }
}

startWPP();
