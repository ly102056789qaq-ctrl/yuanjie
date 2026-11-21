mergeInto(LibraryManager.library, {
  BattleCut: function(beat, progress) {
    if (window.renderRinShot) window.renderRinShot(beat, progress);
  },
  BattleAnchor: function(name, x, y, height) {
    window.stageAnchors[UTF8ToString(name)] = {x: x, y: y, height: height};
  }
});
