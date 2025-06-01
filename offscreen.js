const audioMap = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, id, src, volume = 0.5 } = message;

  switch (action) {
    case 'playLoop':
      stop(id);
      const loopAudio = new Audio(src);
      loopAudio.loop = true;
      loopAudio.volume = volume;
      loopAudio.play();
      audioMap[id] = loopAudio;
      break;

    case 'playOnce':
      const onceAudio = new Audio(src);
      onceAudio.volume = volume;
      onceAudio.play();
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
