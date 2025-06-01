// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const toggleChime = document.getElementById('toggleChime');
  const focusTime = document.getElementById('focusTime');
  const breakTime = document.getElementById('breakTime');
  const startPomodoro = document.getElementById('startPomodoro');
  const stopPomodoro = document.getElementById('stopPomodoro');
  const pomodoroStatus = document.getElementById('pomodoroStatus');

  const playBGMButtons = document.querySelectorAll('.playBGM');
  const stopBGMButton = document.getElementById('stopBGM');
  const bgmVolume = document.getElementById('bgmVolume');

  const playAmbientButtons = document.querySelectorAll('.playAmbient');
  const stopAmbientButton = document.getElementById('stopAmbient');
  const ambientVolume = document.getElementById('ambientVolume');

  const chimeVolume = document.getElementById('chimeVolume');

  // 設定値を復元
  const data = await chrome.storage.local.get([
    'isHourlyChimeOn',
    'bgmVolume',
    'ambientVolume',
    'chimeVolume',
    'focusMinutes',
    'breakMinutes'
  ]);

  toggleChime.checked = data.isHourlyChimeOn ?? false;
  bgmVolume.value = data.bgmVolume ?? 0.5;
  ambientVolume.value = data.ambientVolume ?? 0.5;
  chimeVolume.value = data.chimeVolume ?? 0.5;
  focusTime.value = data.focusMinutes ?? 25;
  breakTime.value = data.breakMinutes ?? 5;
  
  // 毎時鐘のオンオフ
  toggleChime.addEventListener('change', () => {
    const enabled = toggleChime.checked;
    chrome.storage.local.set({ isHourlyChimeOn: enabled });
    chrome.runtime.sendMessage({ action: 'toggleChime', enabled });
  });

  // 音量変更処理
  const handleVolumeChange = (slider, id) => {
    slider.addEventListener('input', () => {
      const vol = parseFloat(slider.value);
      chrome.storage.local.set({ [`${id}Volume`]: vol });
      chrome.runtime.sendMessage({ action: 'setVolume', id, volume: vol });
    });
  };

  handleVolumeChange(bgmVolume, 'bgm');
  handleVolumeChange(ambientVolume, 'ambient');
  handleVolumeChange(chimeVolume, 'chime');
  
  // ポモドーロ設定が変更されたら保存
  focusTime.addEventListener('input', () => {
    const value = parseInt(focusTime.value, 10);
    if (!isNaN(value)) {
      chrome.storage.local.set({ focusMinutes: value });
    }
  });
  
  breakTime.addEventListener('input', () => {
    const value = parseInt(breakTime.value, 10);
    if (!isNaN(value)) {
      chrome.storage.local.set({ breakMinutes: value });
    }
  });
  
  // ポモドーロ開始
  startPomodoro.addEventListener('click', () => {
    const focusMinutes = parseInt(focusTime.value, 10);
    const breakMinutes = parseInt(breakTime.value, 10);
    chrome.runtime.sendMessage({ action: 'startPomodoro', focusMinutes, breakMinutes });

    chrome.runtime.sendMessage({
      action: 'playLoop',
      id: 'bgm',
      src: 'sounds/focus.mp3',
      volume: parseFloat(bgmVolume.value)
    });
  });

  // ポモドーロ停止
  stopPomodoro.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopPomodoro' });
    pomodoroStatus.textContent = '停止中';
  });

  // BGM再生停止
  stopBGMButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stop', id: 'bgm' });
  });

  // BGM選択再生
  playBGMButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.bgm;
      chrome.runtime.sendMessage({
        action: 'playLoop',
        id: 'bgm',
        src: `sounds/${type}.mp3`,
        volume: parseFloat(bgmVolume.value)
      });
    });
  });

  // 環境音再生・停止
  playAmbientButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.ambient;
      chrome.runtime.sendMessage({
        action: 'playLoop',
        id: 'ambient',
        src: `sounds/${type}.mp3`,
        volume: parseFloat(ambientVolume.value)
      });
    });
  });

  stopAmbientButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stop', id: 'ambient' });
  });

  // ポモドーロ進行状況の表示
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'updatePomodoro') {
      const min = Math.floor(msg.remainingTime / 60);
      const sec = msg.remainingTime % 60;
      pomodoroStatus.textContent = `${msg.currentMode === 'focus' ? '集中' : '休憩'} ${min}分${sec}秒`;
    }
  });

  // バックグラウンドに設定を再送信して状態を同期
  chrome.runtime.sendMessage({
    action: 'toggleChime',
    enabled: toggleChime.checked
  });

  chrome.runtime.sendMessage({
    action: 'setVolume',
    id: 'chime',
    volume: parseFloat(chimeVolume.value)
  });

  chrome.runtime.sendMessage({
    action: 'setVolume',
    id: 'bgm',
    volume: parseFloat(bgmVolume.value)
  });

  chrome.runtime.sendMessage({
    action: 'setVolume',
    id: 'ambient',
    volume: parseFloat(ambientVolume.value)
  });

});
