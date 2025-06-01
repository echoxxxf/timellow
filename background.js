// background.js
const audioMap = {};

let isHourlyChimeOn = false;
let isPomodoroRunning = false;
let focusDuration = 50 * 60;
let breakDuration = 10 * 60;
let timer = null;
let currentMode = 'focus';
let remainingTime = focusDuration;

// 音量管理
let volumes = {
  bgm: 0.5,
  ambient: 0.5,
  chime: 0.5
};

// Audioの再生・停止管理
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
  chrome.runtime.sendMessage({
    action: 'playLoop',
    id,
    src,
    volume
  });
}

async function playAudioOnce(id, src, volume = 1.0) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({
    action: 'playOnce',
    id,
    src,
    volume
  });
}

async function stopAudio(id) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({
    action: 'stop',
    id
  });
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
    case 'toggleChime':
      isHourlyChimeOn = message.enabled;
      chrome.alarms.clear('hourlyChime');
      if (isHourlyChimeOn) {
        // 毎時0分に鐘を鳴らすアラームセット（最初に現在の時刻から次の0分まで）
        scheduleNextHourlyChime();
      }
      break;

    case 'setVolume':
    if (message.id && typeof message.volume === 'number') {
      volumes[message.id] = message.volume;

      // 音量変更を offscreen.js に送信
      chrome.runtime.sendMessage({
        action: 'setVolume',
        id: message.id,
        volume: message.volume
      });
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
      if (isPomodoroRunning) {
        clearInterval(timer);
      }
      focusDuration = message.focusMinutes * 60;
      breakDuration = message.breakMinutes * 60;
      currentMode = 'focus';
      remainingTime = focusDuration;
      isPomodoroRunning = true;
      chrome.runtime.sendMessage({ action: 'updatePomodoro', currentMode, remainingTime });

      timer = setInterval(() => {
        remainingTime--;
        chrome.runtime.sendMessage({ action: 'updatePomodoro', currentMode, remainingTime });
        if (remainingTime <= 0) {
          // 切り替え音を鳴らす
          playAudioOnce('clock', 'sounds/clock.mp3', volumes.clock ?? 1.0);
          
          if (currentMode === 'focus') {
            currentMode = 'break';
            remainingTime = breakDuration;
            // 休憩BGMに切り替え
            playAudioLoop('bgm', 'sounds/break.mp3', volumes.bgm);
          } else {
            currentMode = 'focus';
            remainingTime = focusDuration;
            // 集中BGMに切り替え
            playAudioLoop('bgm', 'sounds/focus.mp3', volumes.bgm);
          }
        }
      }, 1000);
      // 開始時に集中BGMも再生（重複防止）
      playAudioLoop('bgm', 'sounds/focus.mp3', volumes.bgm);
      break;

    case 'stopPomodoro':
      if (isPomodoroRunning) {
        clearInterval(timer);
        isPomodoroRunning = false;
      }
      stopAudio('bgm');
      chrome.runtime.sendMessage({ action: 'updatePomodoro', currentMode: null, remainingTime: 0 });
      break;
  }
  sendResponse();
  return true;
});

function scheduleNextHourlyChime() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1);
  nextHour.setMinutes(0, 0, 0);

  const delay = nextHour.getTime() - now.getTime();

  chrome.alarms.create('hourlyChime', { when: Date.now() + delay });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'hourlyChime' && isHourlyChimeOn) {
    // 1回目の再生
    playAudioOnce('chime', 'sounds/chime.mp3', volumes.chime);

    // 少し待って2回目の再生（例：1秒後）
    setTimeout(() => {
      playAudioOnce('chime_2', 'sounds/chime.mp3', volumes.chime);
    }, 1000); // 1000ミリ秒 = 1秒

    scheduleNextHourlyChime();
  }
});
