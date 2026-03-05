// State
let events = JSON.parse(localStorage.getItem('sleepEvents')) || [];
const VIEWS = {
    TRACKER: 'tracker-view',
    QUESTION: 'question-view',
    REPORT: 'report-view'
};

// DOM Elements
const timeDisplay = document.getElementById('current-time'); // may not exist now, but keep reference safe

// Initialize
function init() {
    renderEvents();
    setupEventListeners();
}


function addEvent(type, btnElement) {
    const now = new Date();
    const event = {
        id: Date.now().toString(),
        type: type, // 'Bed', 'Wake', 'Up'
        timestamp: now.getTime(),
        displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    events.push(event);
    saveEvents();
    renderEvents();

    // Feedback
    if (navigator.vibrate) {
        navigator.vibrate(50); // Short 50ms vibration
    }

    showToast(type + ' Recorded');

    if (btnElement) {
        btnElement.classList.remove('flash-active');
        // trigger reflow to restart animation
        void btnElement.offsetWidth;
        btnElement.classList.add('flash-active');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (!toast.classList.contains('show')) {
                toast.classList.add('hidden');
            }
        }, 300);
    }, 1000);
}

function deleteEvent(id) {
    events = events.filter(e => e.id !== id);
    saveEvents();
    renderEvents();

    // Rebuild questionnaire if we're on that view
    if (document.getElementById(VIEWS.QUESTION).classList.contains('active')) {
        buildQuestionnaire();
    }
}

function clearEvents() {
    if (confirm('Are you sure you want to clear all events for tonight?')) {
        events = [];
        saveEvents();
        renderEvents();
    }
}

function saveEvents() {
    localStorage.setItem('sleepEvents', JSON.stringify(events));
}

function renderEvents() {
    const lists = document.querySelectorAll('.event-list');

    let htmlContent = '';
    if (events.length === 0) {
        htmlContent = '<li class="event-item"><span style="color: var(--text-secondary)">No events recorded yet.</span></li>';
    } else {
        const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

        sortedEvents.forEach(event => {
            let icon = '';
            let color = '';
            if (event.type === 'Bed') { icon = '🛏️'; color = 'var(--accent-blue)'; }
            else if (event.type === 'Wake') { icon = '👁️'; color = 'var(--accent-orange)'; }
            else if (event.type === 'Calming') { icon = '🧘'; color = 'var(--accent-purple)'; }
            else if (event.type === 'Listening') { icon = '🎧'; color = '#14b8a6'; }
            else if (event.type === 'Get Up') { icon = '🚶'; color = 'var(--accent-green)'; }

            htmlContent += `
                <li class="event-item">
                    <div class="event-info">
                        <span style="font-size: 20px;">${icon}</span>
                        <span class="event-type" style="color: ${color}">${event.type}</span>
                        <span class="event-time">${event.displayTime}</span>
                    </div>
                    <button class="btn-delete-event" onclick="deleteEvent('${event.id}')" aria-label="Delete Event">✕</button>
                </li>
            `;
        });
    }

    lists.forEach(list => {
        list.innerHTML = htmlContent;
        list.scrollTop = list.scrollHeight;
    });
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function setupEventListeners() {
    // Tracking Buttons
    document.getElementById('btn-bed').addEventListener('click', (e) => addEvent('Bed', e.currentTarget));
    document.getElementById('btn-wake').addEventListener('click', (e) => addEvent('Wake', e.currentTarget));
    document.getElementById('btn-calming').addEventListener('click', (e) => addEvent('Calming', e.currentTarget));
    document.getElementById('btn-listening').addEventListener('click', (e) => addEvent('Listening', e.currentTarget));
    document.getElementById('btn-up').addEventListener('click', (e) => addEvent('Get Up', e.currentTarget));

    // Clear
    document.querySelectorAll('.btn-clear-events').forEach(btn => {
        btn.addEventListener('click', clearEvents);
    });

    // Done Button - Transitions to Questionnaire
    document.getElementById('btn-done').addEventListener('click', () => {
        if (events.length === 0) {
            alert("No events recorded tonight!");
            return;
        }
        buildQuestionnaire();
        showView(VIEWS.QUESTION);
    });

    // Back Buttons
    document.querySelectorAll('.btn-back-to-tracker').forEach(btn => {
        btn.addEventListener('click', () => showView(VIEWS.TRACKER));
    });

    // Calculate Button
    document.getElementById('btn-calculate').addEventListener('click', calculateReport);

    // Finish / Reset Button
    document.getElementById('btn-finish').addEventListener('click', () => {
        events = [];
        saveEvents();
        renderEvents();
        showView(VIEWS.TRACKER);
    });
}

// ============== LOGIC FOR QUESTIONNAIRE ==============

let currentSleepSegments = []; // Stores { type: string, displayTime: string, timestamp: number, nextTimestamp: number, id: string }

function buildQuestionnaire() {
    const qContainer = document.getElementById('questions-container');
    qContainer.innerHTML = '';
    currentSleepSegments = [];

    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    if (sortedEvents.length < 2) {
        qContainer.innerHTML = '<p style="color: var(--accent-orange)">Not enough data to calculate sleep taking time. Try adding more events.</p>';
        return;
    }

    // Every event up to the second-to-last gets a question (the last event is assumed to be Get Up)
    for (let i = 0; i < sortedEvents.length - 1; i++) {
        const ev = sortedEvents[i];

        currentSleepSegments.push({
            id: `latency-${i}`,
            type: ev.type,
            displayTime: ev.displayTime,
            timestamp: ev.timestamp,
            nextTimestamp: sortedEvents[i + 1].timestamp
        });
    }

    currentSleepSegments.forEach((seg, index) => {
        const div = document.createElement('div');
        div.className = 'question-card';

        let text = `At <strong>${seg.displayTime}</strong> when you marked <strong>${seg.type}</strong>, how many minutes till you fell asleep? <br><small style="color:var(--text-secondary)">(Enter 0 if you did not fall asleep)</small>`;

        div.innerHTML = `
            <p class="question-text">${text}</p>
            <div class="input-group">
                <input type="number" id="${seg.id}" class="mins-input" min="0" value="0">
                <span style="color: var(--text-secondary)">minutes</span>
            </div>
        `;
        qContainer.appendChild(div);
    });
}


// ============== LOGIC FOR FINAL REPORT ==============

function calculateReport() {
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
    if (sortedEvents.length === 0) return;

    let firstBedTime = new Date(sortedEvents[0].timestamp);
    let finalWakeTime = new Date(sortedEvents[sortedEvents.length - 1].timestamp);

    let initialLatencyMins = 0;
    let wakeCount = 0;
    let totalAwakeTimeMins = 0;

    let hasSlept = false;

    // Find the last segment where they fell asleep (to identify the final awakening period)
    let lastSleepSegmentIndex = -1;
    currentSleepSegments.forEach((seg, index) => {
        let latVal = parseInt(document.getElementById(seg.id)?.value) || 0;
        if (latVal > 0) {
            lastSleepSegmentIndex = index;
        }
    });

    currentSleepSegments.forEach((seg, index) => {
        let latVal = parseInt(document.getElementById(seg.id)?.value) || 0;
        let durationToNextMins = (seg.nextTimestamp - seg.timestamp) / 60000;

        let timeAwakeMins = latVal > 0 ? latVal : durationToNextMins;

        // Clamp to avoid overlapping segments if they enter a latency > duration
        if (timeAwakeMins > durationToNextMins) {
            timeAwakeMins = durationToNextMins;
        }

        if (!hasSlept) {
            // Haven't successfully fallen asleep for the first time yet
            initialLatencyMins += timeAwakeMins;

            if (latVal > 0) {
                // Fell asleep!
                hasSlept = true;
            }
        } else {
            // Have slept already, so we are awake during this segment

            // Exclude the time spent awake if this is the final awakening event leading to 'Get Up'
            // Anything after the last segment where they fell back asleep is the final awakening.
            if (index <= lastSleepSegmentIndex) {
                totalAwakeTimeMins += timeAwakeMins;

                // Only count "Wake" events explicitly for the wake counter after initial sleep
                if (seg.type === 'Wake') {
                    wakeCount++;
                }
            }
        }
    });

    // Populate Report UI
    document.getElementById('rep-first-bed').textContent = formatTime(firstBedTime);
    document.getElementById('rep-fall-asleep').textContent = `${Math.round(initialLatencyMins)} min`;
    document.getElementById('rep-wake-count').textContent = wakeCount.toString();
    document.getElementById('rep-wake-time').textContent = `${Math.round(totalAwakeTimeMins)} min`;
    document.getElementById('rep-final-wake').textContent = formatTime(finalWakeTime);

    showView(VIEWS.REPORT);
}

function formatTime(dateObj) {
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Start
init();
