const audioMap = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, id, src, volume = 0.5 } = message;

  switch (action) {
    case 'playLoop':
      stop(id);
      try {
        const loopAudio = new Audio(src);
        loopAudio.loop = true;
        loopAudio.volume = volume;
        loopAudio.play().catch(console.error);
        audioMap[id] = loopAudio;
      } catch (e) {
        console.error(`Error playing loop for ${id}:`, e);
      }
      break;

    case 'playOnce':
      try {
        const onceAudio = new Audio(src);
        onceAudio.volume = volume;
        onceAudio.play().catch(console.error);
      } catch (e) {
        console.error(`Error playing once for ${id}:`, e);
      }
      break;

    case 'stop':
      stop(id);
      break;

    case 'setVolume':
      if (audioMap[id]) {
        audioMap[id].volume = volume;
      }
      break;
  }

  function stop(id) {
    if (audioMap[id]) {
      audioMap[id].pause();
      delete audioMap[id];
    }
  }

  sendResponse();
});
