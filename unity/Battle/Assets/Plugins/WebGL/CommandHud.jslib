mergeInto(LibraryManager.library, {
  CommandHudSignal: function (ptr) {
    var value = UTF8ToString(ptr);
    if (value === 'ready') window.commandHudReady = true;
    else if (value === 'painted') window.commandHudPainted = true;
    else if (window.parent.yjNativeHudInput) window.parent.yjNativeHudInput(value);
  }
});
