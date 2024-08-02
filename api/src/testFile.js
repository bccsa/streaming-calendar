import ICalParser from "ical-js-parser";
import * as luxon from "luxon";



const icalUrl = 'https://widgets.bcc.no/ical-b941f1689dc179f4/46513/Portal-Calendar.ics';
const limit = 7;
const now = luxon.DateTime.now();

// Get iCal data from URL
async function fetchICalData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const data = await response.text();
        return ICalParser.default.toJSON(data);
    } catch (error) {
        console.error(error.message)
    }
}

const calendar = await fetchICalData(icalUrl)

// Get events from iCal data
const events = calendar.events
console.log(events);
// filter events to only include future events - / + 10minutes
const future = events.filter((event) => {
    const start = luxon.DateTime.fromISO(event.dtstart.value);
    return start.plus({ minutes: 10}) >= now    // Show events that started 10 minutes ago or later
})

// Sort events by start date
const sorted = future.sort((a, b) => {
    const startA = luxon.DateTime.fromISO(a.dtstart.value).toMillis();
    const startB = luxon.DateTime.fromISO(b.dtstart.value).toMillis(); 
    
    if (startA > startB) return 1
    if (startA < startB) return -1
    return 0
})

// Include the oldest xx number of filtered and sorted events (to limit output)
const limited = sorted.slice(0, limit)

// Validate and map results to new object structure (if we want to)
const mapped = limited.map((entry) => {
    const start = luxon.DateTime.fromISO(entry.dtstart.value);
    const end = luxon.DateTime.fromISO(entry.dtend.value);
    return {
        start,
        duration: end - start,
        categories: entry.categories,
        description: entry.description,
        summary: entry.summary,
    }
})

// Segregate result into today, tomorrow, later
const segregated = {
    today: [],
    tomorrow: [],
    later: [],
}

mapped.forEach(event => {
    if (event.start.hasSame(now, 'day')) {
        segregated.today.push(event);
    } else if (event.start.hasSame(now.plus({ days: 1 }), 'day')) {
        segregated.tomorrow.push(event);
    } else {
        segregated.later.push(event);
    }
});

console.log(segregated)
// TODO: Send results to client web page