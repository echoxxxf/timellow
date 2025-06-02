let isHourlyChimeOn = false;
let isPomodoroRunning = false;

let focusDuration = 50 * 60;
let breakDuration = 10 * 60;

let timer = null;
let currentMode = 'focus';
let remainingTime = focusDuration;

let volumes = {
  bgm: 0.5,
  ambient: 0.5,
  chime: 0.5
};

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'ポモドーロや環境音、鐘の音の再生に必要なため'
    });
  }
}

async function playAudioLoop(id, src, volume = 0.5) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ action: 'playLoop', id, src, volume });
}

async function playAudioOnce(id, src, volume = 1.0) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ action: 'playOnce', id, src, volume });
}

async function stopAudio(id) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ action: 'stop', id });
}

function startBGM(mode) {
  const src = mode === 'focus' ? 'sounds/focus.mp3' : 'sounds/break.mp3';
  playAudioLoop('bgm', src, volumes.bgm);
}

function scheduleNextHourlyChime() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);  // 次の時間の0分0秒0ミリ秒にセット
  const delay = nextHour.getTime() - now.getTime();

  chrome.alarms.clear('hourlyChime', () => {
    chrome.alarms.create('hourlyChime', { when: Date.now() + delay });
    console.log(`[scheduleNextHourlyChime] Scheduled next alarm in ${delay} ms`);
  });
}

function stopPomodoro() {
  if (isPomodoroRunning) {
    clearInterval(timer);
    timer = null;
    isPomodoroRunning = false;
  }
  stopAudio('bgm');
  chrome.runtime.sendMessage({ action: 'updatePomodoro', currentMode: null, remainingTime: 0 });
}

function startPomodoro(focusMinutes, breakMinutes) {
  if (isPomodoroRunning) clearInterval(timer);

  focusDuration = (typeof focusMinutes === 'number' && focusMinutes > 0) ? focusMinutes * 60 : 50 * 60;
  breakDuration = (typeof breakMinutes === 'number' && breakMinutes > 0) ? breakMinutes * 60 : 10 * 60;

  currentMode = 'focus';
  remainingTime = focusDuration;
  isPomodoroRunning = true;

  chrome.runtime.sendMessage({ action: 'updatePomodoro', currentMode, remainingTime });
  startBGM(currentMode);

  timer = setInterval(() => {
    remainingTime--;
    chrome.runtime.sendMessage({ action: 'updatePomodoro', currentMode, remainingTime });

    if (remainingTime <= 0) {
      playAudioOnce('clock', 'sounds/clock.mp3', volumes.chime);
      currentMode = currentMode === 'focus' ? 'break' : 'focus';
      remainingTime = currentMode === 'focus' ? focusDuration : breakDuration;
      startBGM(currentMode);
    }
  }, 1000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'toggleChime':
      isHourlyChimeOn = message.enabled;
      chrome.storage.local.set({ isHourlyChimeOn });
      chrome.alarms.clear('hourlyChime');
      if (isHourlyChimeOn) scheduleNextHourlyChime();
      break;

    case 'setVolume':
      if (message.id && typeof message.volume === 'number') {
        volumes[message.id] = message.volume;
        chrome.runtime.sendMessage({ action: 'setVolume', id: message.id, volume: message.volume });
      }
      break;

    case 'playLoop':
      playAudioLoop(message.id, message.src, volumes[message.id] ?? 0.5);
      break;

    case 'playOnce':
      playAudioOnce(message.id, message.src, volumes[message.id] ?? 1.0);
      break;

    case 'stop':
      stopAudio(message.id);
      break;

    case 'startPomodoro':
      startPomodoro(message.focusMinutes, message.breakMinutes);
      break;

    case 'stopPomodoro':
      stopPomodoro();
      break;

    case 'stopAllSounds':
      stopAudio('bgm');
      stopAudio('ambient');
      stopPomodoro();
      break;
  }
  sendResponse();
  return true;
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'hourlyChime' && isHourlyChimeOn) {
    console.log('[Alarm] hourlyChime triggered');
    playAudioOnce('chime', 'sounds/chime.mp3', volumes.chime);
    setTimeout(() => {
      playAudioOnce('chime_2', 'sounds/chime.mp3', volumes.chime);
    }, 1000);
    scheduleNextHourlyChime();
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get('isHourlyChimeOn', data => {
    isHourlyChimeOn = data.isHourlyChimeOn ?? false;
    if (isHourlyChimeOn) scheduleNextHourlyChime();
  });
});
