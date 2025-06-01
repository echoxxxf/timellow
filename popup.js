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

  // 1. 保存されている設定を復元
  const data = await chrome.storage.local.get([
    'isHourlyChimeOn',
    'bgmVolume',
    'ambientVolume',
    'chimeVolume'
  ]);

  toggleChime.checked = data.isHourlyChimeOn ?? false;
  bgmVolume.value = data.bgmVolume ?? 0.5;
  ambientVolume.value = data.ambientVolume ?? 0.5;
  chimeVolume.value = data.chimeVolume ?? 0.5;

  // 2. チェックボックスの変更時に保存＆メッセージ送信
  toggleChime.addEventListener('change', () => {
    const enabled = toggleChime.checked;
    chrome.storage.local.set({ isHourlyChimeOn: enabled });
    chrome.runtime.sendMessage({ action: 'toggleChime', enabled });
  });

  // 3. ボリュームスライダーの保存＆反映
  bgmVolume.addEventListener('input', () => {
    chrome.storage.local.set({ bgmVolume: bgmVolume.value });
    chrome.runtime.sendMessage({ action: 'setVolume', id: 'bgm', volume: parseFloat(bgmVolume.value) });
  });

  ambientVolume.addEventListener('input', () => {
    chrome.storage.local.set({ ambientVolume: ambientVolume.value });
    chrome.runtime.sendMessage({ action: 'setVolume', id: 'ambient', volume: parseFloat(ambientVolume.value) });
  });

  chimeVolume.addEventListener('input', () => {
    chrome.storage.local.set({ chimeVolume: chimeVolume.value });
    chrome.runtime.sendMessage({ action: 'setVolume', id: 'chime', volume: parseFloat(chimeVolume.value) });
  });

  // 4. ポモドーロ開始時にBGM再生も指示
  startPomodoro.addEventListener('click', () => {
    const focusMinutes = parseInt(focusTime.value, 10);
    const breakMinutes = parseInt(breakTime.value, 10);
    chrome.runtime.sendMessage({ action: 'startPomodoro', focusMinutes, breakMinutes });

    // BGMも再生指示を送る（集中BGMスタート）
    chrome.runtime.sendMessage({ action: 'playLoop', id: 'bgm', src: 'sounds/focus.mp3', volume: parseFloat(bgmVolume.value) });
  });

  stopPomodoro.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopPomodoro' });
    pomodoroStatus.textContent = '停止中';
  });

  // 5. BGM再生停止ボタン
  stopBGMButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stop', id: 'bgm' });
  });

  // 6. BGM個別再生ボタン
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

  // 7. 環境音の再生・停止・音量変更
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

  // 8. ポモドーロ状態更新を受け取ってUIに反映
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'updatePomodoro') {
      const min = Math.floor(msg.remainingTime / 60);
      const sec = msg.remainingTime % 60;
      pomodoroStatus.textContent = `${msg.currentMode === 'focus' ? '集中' : '休憩'} ${min}分${sec}秒`;
    }
  });

  // 9. UI起動時に鐘の音のボリュームをbackground.jsにセット（再生されなくても）
  chrome.runtime.sendMessage({ action: 'setVolume', id: 'chime', volume: parseFloat(chimeVolume.value) });

  // 10. 毎時の鐘設定がオンならbackground.jsに通知しておく
  chrome.runtime.sendMessage({ action: 'toggleChime', enabled: toggleChime.checked });
});
