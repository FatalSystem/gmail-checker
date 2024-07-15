const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const { default: axios } = require("axios");
// Якщо ви зміните ці SCOPES, видаліть файл token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const TOKEN_PATH = "token.json";

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
function checkNewEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const TELEGRAM_TOKEN = "7266099507:AAG5KFAjz1QTxncX6AOOIIlyh4nR0ma4LLo";
  const TELEGRAM_CHAT_ID = 466616096;
  setInterval(() => {
    gmail.users.messages.list(
      {
        userId: "me",
        labelIds: "INBOX",
        q: "is:unread",
      },
      (err, res) => {
        if (err) return console.log("API повернув помилку: " + err);
        const messages = res.data.messages;
        if (messages && messages.length) {
          console.log("Знайдено нові листи:");
          gmail.users.messages.get(
            {
              userId: "me",
              id: messages[0].id,
            },
            async (err, res) => {
              if (err) return console.log("API повернув помилку: " + err);
              else if (res.data) {
                const msg = res.data;
                var url =
                  msg.snippet &&
                  `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=593981143&text=${
                    msg.snippet +
                    "\n" +
                    "*Current Time: *" +
                    new Date().toLocaleTimeString()
                  }`;
                var url2 =
                  msg.snippet &&
                  `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=466616096&text=${
                    msg.snippet +
                    "\n" +
                    "*Current Time: *" +
                    new Date().toLocaleTimeString()
                  }`;
                console.log(`- ${msg.snippet}`);
                await markMessageAsRead(auth, messages[0].id).then(async () => {
                  await axios.post(url);
                  await axios.post(url2);
                });
              }
            }
          );
        } else {
          console.log("Нових листів немає.");
        }
      }
    );
  }, 1000); // Перевіряти кожні 10 секунд
}
async function markMessageAsRead(auth, messageId) {
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const response = gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: {
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
