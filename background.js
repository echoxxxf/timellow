const audioMap = {};

let isHourlyChimeOn = false;
let isPomodoroRunning = false;

// 初期フォーカス・休憩時間（秒単位）
let focusDuration = 50 * 60;
let breakDuration = 10 * 60;

// ポモドーロの状態管理用変数
let timer = null;
let currentMode = 'focus';
let remainingTime = focusDuration;

// 音量管理
let volumes = {
  bgm: 0.5,
  ambient: 0.5,
  chime: 0.5
};

// Offscreen Documentの存在を確認し、なければ作成する
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

// ループ再生用
async function playAudioLoop(id, src, volume = 0.5) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({
    action: 'playLoop',
    id,
    src,
    volume
  });
}

// 一度だけ再生用
async function playAudioOnce(id, src, volume = 1.0) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({
    action: 'playOnce',
    id,
    src,
    volume
  });
}

// 再生停止用
async function stopAudio(id) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({
    action: 'stop',
    id
  });
}

// 毎時の鐘の次回スケジュール設定（現在の時刻から次の0分ジャストまでの遅延を計算）
function scheduleNextHourlyChime() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1);
  nextHour.setMinutes(0, 0, 0);

  const delay = nextHour.getTime() - now.getTime();

  chrome.alarms.create('hourlyChime', { when: Date.now() + delay });
}

// メッセージ受信イベント
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
    case 'toggleChime':
      isHourlyChimeOn = message.enabled;
      chrome.alarms.clear('hourlyChime');
      if (isHourlyChimeOn) {
        scheduleNextHourlyChime();
      }
      break;

    case 'setVolume':
      if (message.id && typeof message.volume === 'number') {
        volumes[message.id] = message.volume;

        // offscreen.jsに音量変更を通知（ここで送る意味はある？）
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
      // ポモドーロが既に動いていたらクリア
      if (isPomodoroRunning) {
        clearInterval(timer);
      }
      // 受け取った分数を秒に変換して設定
      focusDuration = (typeof message.focusMinutes === 'number' && message.focusMinutes > 0) ? message.focusMinutes * 60 : 50 * 60;
      breakDuration = (typeof message.breakMinutes === 'number' && message.breakMinutes > 0) ? message.breakMinutes * 60 : 10 * 60;

      currentMode = 'focus';
      remainingTime = focusDuration;
      isPomodoroRunning = true;

      // UIに初期状態を送る
      chrome.runtime.sendMessage({ action: 'updatePomodoro', currentMode, remainingTime });

      // 1秒ごとに残り時間を減らし、モード切替とBGM切替を行う
      timer = setInterval(() => {
        remainingTime--;
        chrome.runtime.sendMessage({ action: 'updatePomodoro', currentMode, remainingTime });

        if (remainingTime <= 0) {
          // ポモドーロ切り替え音を鳴らす
          playAudioOnce('clock', 'sounds/clock.mp3', volumes.chime);

          if (currentMode === 'focus') {
            currentMode = 'break';
            remainingTime = breakDuration;
            // 休憩BGM再生
            playAudioLoop('bgm', 'sounds/break.mp3', volumes.bgm);
          } else {
            currentMode = 'focus';
            remainingTime = focusDuration;
            // 集中BGM再生
            playAudioLoop('bgm', 'sounds/focus.mp3', volumes.bgm);
          }
        }
      }, 1000);

      // ポモドーロ開始時に集中BGMも再生（重複防止のため、すでに上のsetInterval内で再生されるケースもある）
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
  return true; // 非同期応答を可能にするためにtrueを返す
});

// アラーム発火時の処理
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'hourlyChime' && isHourlyChimeOn) {
    // 1回目の鐘の音を再生
    playAudioOnce('chime', 'sounds/chime.mp3', volumes.chime);

    // 1秒後に2回目の鐘の音を再生
    setTimeout(() => {
      playAudioOnce('chime_2', 'sounds/chime.mp3', volumes.chime);
    }, 1000); // 1000ミリ秒 = 1秒

    // 次回の鐘の音スケジュールをセット
    scheduleNextHourlyChime();
  }
});

// 全てのサウンドを停止
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'stopAllSounds') {
    // BGM・環境音・ポモドーロ・時報すべて停止
    stopAudio('bgm');
    stopAudio('ambient');
    stopPomodoro(); // すでに関数がある前提
  }
});
