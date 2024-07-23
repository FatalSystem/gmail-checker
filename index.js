const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const { default: axios } = require("axios");
const { Gaxios } = require("gaxios");
// Якщо ви зміните ці SCOPES, видаліть файл token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.labels",
];
const whiteList = [
  "joins",
  "increasing",
  "raised",
  "adding",
  "moves to",
  "rejoins",
];
const backList = ["watchlist"];
const TOKEN_PATH = "token.json";
const TELEGRAM_TOKEN = "7266099507:AAG5KFAjz1QTxncX6AOOIIlyh4nR0ma4LLo";
// const token = require("./token.json")
// Завантажте секрет клієнта з локального файлу.
fs.readFile("credentials.json", (err, content) => {
  if (err)
    return console.log("Помилка завантаження файлу секретів клієнта:", err);
  // Авторизуйте клієнта з обліковими даними, потім викличте Gmail API.
  authorize(JSON.parse(content), checkNewEmails);
});
/**
 * Створіть клієнт OAuth2 з наданими обліковими даними та виконайте
 * вказану функцію зворотного виклику.
 * @param {Object} credentials Облікові дані клієнта авторизації.
 * @param {function} callback Зворотний виклик для виклику з авторизованим клієнтом.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Перевірте, чи раніше ми зберігали токен.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Отримати та зберегти новий токен після запиту на авторизацію користувача,
 * потім виконайте вказану функцію зворотного виклику з авторизованим OAuth2 клієнтом.
 * @param {google.auth.OAuth2} oAuth2Client OAuth2 клієнт для отримання токена.
 * @param {getEventsCallback} callback Зворотний виклик для авторизованого клієнта.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Авторизуйте цей додаток, відвідавши цей URL:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("Введіть код з цієї сторінки тут: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Помилка отримання токена доступу", err);
      oAuth2Client.setCredentials(token);
      // Зберегти токен на диск для подальших виконань програми
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log("Токен збережено до", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Перевірити нові листи в обліковому записі користувача.
 *
 * @param {google.auth.OAuth2} auth Авторизований клієнт OAuth2.
 */
const processedMessages = new Set(); // To keep track of processed messages
let isProcessing = false; // To ensure only one processing cycle runs at a time

function checkNewEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });

  setInterval(async () => {
    if (isProcessing) return; // Prevent overlapping intervals
    isProcessing = true; // Mark as processing

    try {
      const res = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        q: "is:unread",
      });

      const messages = res.data.messages;

      if (messages && messages.length > 0) {
        for (const message of messages) {
          if (!processedMessages.has(message.id)) {
            processedMessages.add(message.id);

            const msgRes = await gmail.users.messages.get({
              userId: "me",
              id: message.id,
            });

            const msg = msgRes.data;
            const title = msg.payload.headers?.find((info) =>
              info.name.includes("Subject")
            )?.value;

            const isSendMessage =
              whiteList.some((word) =>
                title.toLowerCase().includes(word.toLowerCase())
              ) &&
              !backList.some((word) =>
                title.toLowerCase().includes(word.toLowerCase())
              ) &&
              msg.payload.headers
                ?.find((info) => info.name.includes("From"))
                ?.value.search("do-not-reply@mail.investors.com") !== -1;

            console.log("🚀 ~ isSendMessage:", isSendMessage);

            const currentTime =
              "<b><u>Current time</u>: </b>" + new Date().toTimeString();
            const currentTitle = "<b><u>Title</u>: </b>" + title;
            const customMessage =
              "📈 LEADERBOARD %0A" + currentTitle + "%0A" + currentTime;
            const label =
              msg.payload.headers
                ?.find((info) => info.name.includes("From"))
                ?.value.search("do-not-reply@mail.investors.com") !== -1
                ? "LEADERBOARD"
                : msg.payload.headers
                    ?.find((info) => info.name.includes("From"))
                    ?.value.search("oxford@mail.oxfordclub.com") !== -1 &&
                  "OXFORD";

            // Mark message as read before sending
            isSendMessage && (await markMessageAsRead(auth, message.id, label));

            // Send message to bot

            isSendMessage &&
              (await sendMessageToBot(customMessage, isSendMessage));
          }
        }
      } else {
        console.log("Нових листів немає.");
      }
    } catch (err) {
      console.error("API повернув помилку: " + err);
    } finally {
      isProcessing = false; // Mark as not processing
    }
  }, 1000); // Checking every 10 seconds
}

// Ensure you have a valid OAuth2 client and call checkNewEmails with it

// Ensure you have a valid OAuth2 client and call checkNewEmails with it

// Ensure you have valid OAuth2 client and call checkNewEmails with it

async function markMessageAsRead(auth, messageId, label) {
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const labelsRes = await gmail.users.labels.list({
      userId: "me",
    });
    const labels = labelsRes.data.labels;
    console.log("Labels:", labels);
    console.log("Label created:", labelsRes.data);
    const labelId = labels.find((_label) => _label.name === label).id;
    const response = gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: {
        addLabelIds: [labelId],
        removeLabelIds: ["UNREAD"], // Note: Label IDs are case-sensitive
      },
    });
    console.log("Message marked as read:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error marking message as read:", error.message);
    throw error;
  }
}

async function sendMessageToBot(message, isSendMessage) {
  const url =
    message &&
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=593981143&text=${message}&parse_mode=HTML`;
  const url2 =
    message &&
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=466616096&text=${message}&parse_mode=HTML`;

  isSendMessage &&
    (await axios.post(url, {
      data: {
        parse_mode: "HTML",
      },
    }));
  isSendMessage &&
    (await axios.post(url2, {
      data: {
        parse_mode: "HTML",
      },
    }));
}

async function createLabel(auth, messageId) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.modify({
    userId: "me",
    id: messageId, // replace with your message ID
    requestBody: {
      addLabelIds: ["LEADERBOARD"],
      removeLabelIds: ["UNREAD"],
    },
  });
  return res.data.id;
}

// Ensure you have a valid OAuth2 client and call createLabel with it
