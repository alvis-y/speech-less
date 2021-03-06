'use strict'

const express = require('express'); // const bodyParser = require('body-parser'); // const path = require('path');
const fs = require('fs');
const environmentVars = require('dotenv').config();

// Google Cloud
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient(); // Creates a client
const fetch = require("node-fetch");



const app = express();
const port = process.env.PORT || 1337;
const server = require('http').createServer(app);

const io = require('socket.io')(server);

app.use('/assets', express.static(__dirname + '/public'));
app.use('/session/assets', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');


// =========================== ROUTERS ================================ //

app.get('/', function (req, res) {
    res.render('index', {});
});

app.use('/', function (req, res, next) {
    next(); // console.log(`Request Url: ${req.url}`);
});


// =========================== SOCKET.IO ================================ //

io.on('connection', function (client) {
    console.log('Client Connected to server');
    let recognizeStream = null;

    client.on('join', function (data) {
        client.emit('messages', 'Socket Connected to Server');
    });

    client.on('messages', function (data) {
        client.emit('broad', data);
    });

    client.on('startGoogleCloudStream', function (data) {
        startRecognitionStream(this, data);
    });

    client.on('endGoogleCloudStream', function (data) {
        stopRecognitionStream();
    });

    client.on('binaryData', function (data) {
        // console.log(data); //log binary data
        if (recognizeStream !== null) {
            recognizeStream.write(data);
        }
    });

    function startRecognitionStream(client, data) {
        recognizeStream = speechClient.streamingRecognize(request)
            .on('error', console.error)
            .on('data', (data) => {
                // process.stdout.write(
                //     (data.results[0] && data.results[0].alternatives[0])
                //         ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
                //         : `\n\nReached transcription time limit, press Ctrl+C\n`);
                // process.stdout.write(data.results[0]);
                // process.stdout.write(data.results[0].alternatives[0]);
                // process.stdout.write(data.results[0].alternatives);

                client.emit('speechData', data);

                // if end of utterance, let's restart stream
                // this is a small hack. After 65 seconds of silence, the stream will still throw an error for speech length limit
                if (data.results[0] && data.results[0].isFinal) {
                    stopRecognitionStream();
                    startRecognitionStream(client);
                    process.stdout.write("HEWWO");
                    process.stdout.write(data.results[0].alternatives[0].transcript);
                    // console.log('restarted stream serverside');

                    const fetchObj = {
                        body: "sentences_number=1&title=test&text=" + data.results[0].alternatives[0].transcript,
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            "X-Aylien-Textapi-Application-Id": "097ff773",
                            "X-Aylien-Textapi-Application-Key": "a5687de44d5585e08b4fd26770f2df1c"
                        },
                        method: "POST"
                    };
                    
                    fetch("https://api.aylien.com/api/v1/summarize", fetchObj)
                        .then((response) => response.json())
                        .then((content) => {
                            console.log(content);
                        });
                }
            });
    }

    function stopRecognitionStream() {
        if (recognizeStream) {
            recognizeStream.end();
        }
        recognizeStream = null;
    }
});


// =========================== GOOGLE CLOUD SETTINGS ================================ //

// The encoding of the audio file, e.g. 'LINEAR16'
// The sample rate of the audio file in hertz, e.g. 16000
// The BCP-47 language code to use, e.g. 'en-US'
const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'en-US'; //en-US

const request = {
    config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        profanityFilter: false,
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
        // speechContexts: [{
        //     phrases: ["hoful","shwazil"]
        //    }] // add your own speech context for better recognition
    },
    interimResults: true // If you want interim results, set this to true
};


// =========================== START SERVER ================================ //

server.listen(port, "127.0.0.1", function () { //http listen, to make socket work
    // app.address = "127.0.0.1";
    console.log('Server started on port:' + port)
});