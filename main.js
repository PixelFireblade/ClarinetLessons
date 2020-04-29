const fs = require('fs');
const readline = require('readline');
const url = require('url');
const express = require('express');
const waitOn = require('wait-on');

const {
  google
} = require('googleapis');
const ics = require('ics');

const app = express();

app.use(express.static('public'));

app.listen(process.env.PORT || 8080, () => console.log("Port used"));

app.get('/', function (req, res){
  res.sendFile(`${__dirname}/download.html`);
})
app.get('/download', function(req, res){
  const file = `${__dirname}/event.ics`;
  fs.exists(file, (exists) => {
    if (exists) {
      fs.unlink(file, (err) => {
        if (err) throw err;
        console.log("File deleted");
      });
    }
  })
  

  res.send = `${__dirname}/index.html`
  let a = url.parse(req.url, true);
  console.log(a.query.name);

  if (a.query.name.length != 0) {
    start(a.query.name);
    waitOn({resources: ["./event.ics"]}, (err) => {
      if (err) throw err;
      const file = `${__dirname}/event.ics`;
      res.download(file);
    
    });

    
    
  }
  
});



const year = 2020;
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
async function download(file, res) {
  res.download(file);
}
function start(name) {
  fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content), listMajors, name);
  });
  return 1;
}
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, name) {
  const {
    client_secret,
    client_id,
    redirect_uris
  } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, name);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function listMajors(auth, name) {
  const sheets = google.sheets({
    version: 'v4',
    auth
  });
  sheets.spreadsheets.values.get({
    spreadsheetId: '1uOc0yzo5glna6LauZHUA1KovfVQxZOZ74SfLSRU9Nmg',
    range: '!A1:K',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const rows = res.data.values;
    if (rows.length) {
      // console.log(rows)
      let times = parseTimes(rows);
      let events = parseEvents(name, times);
      const eventsP = ics.createEvents(events, (err, data) => {
        if (err) throw err;
        fs.writeFileSync(`${__dirname}/event.ics`, data);
      });


    } else {
      console.log('No data found.');
    }
  });


}

function parseTimes(rows) {
  let days = [];
  let finalTable = [];
  let times = [];
  let rel = false;
  let day = false;
  let timeType = "";
  let timeKey = {
    '8:20 AM': '0820',
    '8:50 AM': '0850',
    '9:30 AM': '0930',
    '10:10 AM': '1010',
    '10:50AM': '1050',
    '11.10 AM': '1110',
    '11:50 AM': '1150',
    '12:30 PM': '1230',
    '1:10 PM': '1310',
    '2:10 PM': '1410',
    '2:50 PM': '1450',
    '3:30 PM': '1530',

  }

  for (let i = 0; i < rows.length; i++) {
    rel = false;
    day = false;
    for (let j = 0; j < rows[i].length; j++) {
      if (rows[i][j].includes("PM") || rows[i][j].includes("AM")) {
        rel = true;
      }
      if (rows[i][j].includes("Wednesday Date")) {
        day = true;
      }
    }
    if (rel == true) {
      times.push(rows[i]);
    }
    if (day == true) {
      days.push(rows[i]);
    }

  }
  days = days.pop();
  days.splice(0, 1);
  // console.log(days);
  // console.log(times);
  let tempDay = {};
  let tempTime = "";
  let finalTime = "";
  for (let i = 0; i < days.length; i++) {
    tempDay = {};
    tempDay.day = days[i].slice(1, days[i].length);
    for (let j = 0; j < times.length; j++) {


      tempTime = "";
      if (times[j][0] != "3:30 PM") {
        tempTime = times[j][0].slice(0, times[j][0].length - 4).trim();
      } else {
        tempTime = times[j][0]
      }



      finalTime = "";
      finalTime = timeKey[tempTime];
      // console.log(finalTime)




      if (times[j][i + 1] != null) {

        tempDay[finalTime] = times[j][i + 1];

      } else {
        tempDay[finalTime] = '';
      }




    }
    finalTable.push(tempDay);
  }
  // console.log(finalTable)
  return finalTable;

}

function parseEvents(name, times) {
  let tempStart = {};
  let relevant = [];
  let months = {
    "January": "1",
    "February": "2",
    "March": "3",
    "April": "4",
    "May": "5",
    "June": "6",
    "July": "7",
    "August": "8",
    "September": "9",
    "October": "10",
    "November": "11",
    "December": "12",
  }
  let tempDate = "";
  let events = [];
  let tempEvent = {};
  for (let i = 0; i < times.length; i++) {
    tempDate = "";

    tempStart = {};

    for (j in times[i]) {
      if (times[i][j] == name) {
        // console.log(times[i][j])
        tempStart.time = j;
        tempDate = times[i]['day'];

        if (tempDate.slice(0,2).includes("-")) { // if 1 digit day
          tempStart.day = tempDate[0];
          tempStart.month = months[tempDate.slice(2,tempDate.length)];
        } else {
          tempStart.day = tempDate.slice(0,2);
          tempStart.month = months[tempDate.slice(3,tempDate.length)];
        }
      }
    }
    if (Object.keys(tempStart).length > 0) {
      relevant.push(tempStart);

    }
  }

  for (let x = 0; x < relevant.length; x++) {
    tempEvent = {
      start: [year, parseInt(relevant[x].month), parseInt(relevant[x].day), parseInt(relevant[x].time.slice(0,2)), parseInt(relevant[x].time.slice(2,4))],
      duration: {hours: 0, minutes: 30},
      title: 'Clarinet Lesson',
      description: 'Clarinet Lesson with Max Harris',
    };
    events.push(tempEvent);
  }
  return events;
}