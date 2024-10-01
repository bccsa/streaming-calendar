import ICalParser from 'ical-js-parser';
import * as luxon from 'luxon';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Server } from 'socket.io';
import fetch from 'node-fetch';
import 'dotenv/config';

const icalUrl = process.env.URL;
const limit = parseInt(process.env.MAX_NUMBER || 10);
let now;
const maxDuration = parseInt(process.env.MAX_DURATION || 7 * 60 * 60 * 1000);
const excludeTitles = process.env.EXCLUDE_TITLES.split(",");

let cache;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

async function getICalData(url) {
    now = luxon.DateTime.now();

    try {
        const tenMinutesBeforeNow = Date.now() - 10 * 60 * 1000;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const icalData = await response.text();
        const ParseData = ICalParser.default.toJSON(icalData);

        // Process events
        const events = ParseData.events;
        const futureEvents = events
            .filter(event => {
                const eventStart = luxon.DateTime.fromISO(event.dtstart.value);
                return eventStart > tenMinutesBeforeNow;
            })
            .sort((a, b) => {
                const dateA = luxon.DateTime.fromISO(a.dtstart.value).toMillis();
                const dateB = luxon.DateTime.fromISO(b.dtstart.value).toMillis();
                return dateA - dateB;
            })
            .slice(0, limit);

        // Map to new object structure
        const mappedEvents = futureEvents.map(event => {
            const start = luxon.DateTime.fromISO(event.dtstart.value);
            const end = luxon.DateTime.fromISO(event.dtend.value);

            return {
                title: event.summary,
                start: start.toISO(),
                end: end.toISO(),
                location: event.location,
                description: event.description,
                categories: event.categories,
                duration: end.toMillis() - start.toMillis(),
            };
        });

        const filteredEvents = mappedEvents.filter(event => {
            // Exclude events that are longer than the max duration
            if (event.duration > maxDuration) return false;

            // Filter events from the EXCLUDE_TITLES list
            for (var i = 0; i < excludeTitles.length; i++) {
                const r = new RegExp(excludeTitles[i], "gi");
                if (excludeTitles[i] && event.title.match(r)) return false;
            }

            return true;
        })

        // Segregate results
        const results = {
            todayEvents: [],
            tomorrowEvents: [],
            laterEvents: []
        };

        filteredEvents.forEach(event => {
            const eventStart = luxon.DateTime.fromISO(event.start);
            if (eventStart.hasSame(now, 'day')) {
                results.todayEvents.push(event);
            } else if (eventStart.hasSame(now.plus({ days: 1 }), 'day')) {
                results.tomorrowEvents.push(event);
            } else {
                results.laterEvents.push(event);
            }
        });

        // Emit results to connected clients
        io.emit('calendar', results);
        cache = results;
    } catch (error) {
        console.error('Error fetching or parsing iCal data:', error);
    }
}

// Fetch and display iCal data initially
getICalData(icalUrl);
// Set interval to fetch and display iCal data every 5 minutes
setInterval(() => {
    getICalData(icalUrl);
}, 5000 * 60);

const __dirname = dirname(fileURLToPath(import.meta.url));
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../../client/src/index.html'));
});

app.get('/output.css', (req, res) => {
    res.sendFile(join(__dirname, '../../client/src/output.css'));
});

io.on('connection', (socket) => {
    socket.emit("calendar", cache);
    console.log('A user connected');
});

httpServer.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});