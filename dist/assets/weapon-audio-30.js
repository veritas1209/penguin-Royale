(() => {
  "use strict";

  function install(tries = 0) {
    const audio = window.__peAudio;
    if (!audio || typeof audio.gunshot !== "function") {
      if (tries < 200) setTimeout(() => install(tries + 1), 25);
      return;
    }
    if (audio.__weaponShots30) return;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const originalGunshot = audio.gunshot.bind(audio);
    const ctx = new AC();
    const master = ctx.createGain();
    let muted = localStorage.getItem("bluecap-muted") === "true";
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    window.__bcMk14Mute112 = value => {
      muted = !!value;
      master.gain.value = muted ? 0 : 1;
    };

    const shotLevels = {"akm-single.mp3":0.793,"akm-suppressed-single.mp3":0.733,"asm-abakan-single.mp3":0.724,"asm-abakan-suppressed-single.mp3":0.699,"aug-single.mp3":0.954,"aug-suppressed-single.mp3":0.821,"awm-single.mp3":0.895,"awm-suppressed-single.mp3":0.863,"beryl-m762-single.mp3":0.939,"beryl-m762-suppressed-single.mp3":1.523,"crossbow-single.mp3":1.174,"dbs-single.mp3":0.95,"deagle-single.mp3":0.672,"dp28-single.mp3":1.056,"famas-single.mp3":1.022,"famas-suppressed-single.mp3":1.168,"g36c-single.mp3":1.2,"g36c-suppressed-single.mp3":0.698,"groza-single.mp3":0.923,"groza-suppressed-single.mp3":0.807,"js9-single.mp3":1.679,"js9-suppressed-single.mp3":1.995,"kar98k-single.mp3":0.9,"kar98k-suppressed-single.mp3":1.175,"lynx-amr-single.mp3":0.527,"m16a4-single.mp3":0.991,"m16a4-suppressed-single.mp3":1.292,"m24-single.mp3":0.768,"m24-suppressed-single.mp3":0.653,"m249-single.mp3":0.582,"m416-single.mp3":1.051,"m416-suppressed-single.mp3":0.937,"mg3-single.mp3":1.067,"micro-uzi-single.mp3":1.397,"micro-uzi-suppressed-single.mp3":1.37,"mini-14-single.mp3":0.942,"mini-14-suppressed-single.mp3":1.519,"mk12-single.mp3":0.824,"mk12-suppressed-single.mp3":1.468,"mk47-mutant-single.mp3":0.825,"mk47-mutant-suppressed-single.mp3":0.768,"mp5k-single.mp3":0.915,"mp5k-suppressed-single.mp3":0.972,"p18c-single.mp3":0.886,"p18c-suppressed-single.mp3":1.413,"p1911-single.mp3":0.808,"p1911-suppressed-single.mp3":1.154,"p90-single.mp3":1.738,"p92-single.mp3":1.005,"p92-suppressed-single.mp3":1.265,"pp19-bizon-single.mp3":0.903,"pp19-bizon-suppressed-single.mp3":0.988,"qbu-single.mp3":0.834,"qbu-suppressed-single.mp3":0.894,"qbz-single.mp3":0.979,"qbz-suppressed-single.mp3":1.192,"r1895-single.mp3":0.939,"r1895-suppressed-single.mp3":1.645,"r45-single.mp3":0.706,"s12k-single.mp3":0.659,"s12k-suppressed-single.mp3":0.422,"s1897-single.mp3":0.94,"s686-single.mp3":0.906,"sawed-off-single.mp3":0.857,"scar-l-single.mp3":1.256,"scar-l-suppressed-single.mp3":1.343,"signal-flare-single.mp3":0.779,"skorpion-single.mp3":0.783,"skorpion-suppressed-single.mp3":0.776,"sks-single.mp3":0.834,"sks-suppressed-single.mp3":1.728,"slr-single.mp3":0.897,"slr-suppressed-single.mp3":1.037,"tommy-gun-single.mp3":0.922,"tommy-gun-suppressed-single.mp3":0.711,"ump-single.mp3":1.146,"ump-suppressed-single.mp3":1.043,"vector-single.mp3":1.159,"vector-suppressed-single.mp3":0.832,"vss-single.mp3":0.839,"win94-single.mp3":0.801,"mk14-single-v2-25.mp3":0.989,"mk14-suppressed-v2-25.mp3":0.304};
    const buffers = new Map();
    const seen = new Map();
    const weapons = new Map();
    function absolute(path) { return new URL(path, document.baseURI).href; }
    function load(url) {
      if (!buffers.has(url)) {
        buffers.set(url, fetch(url, {cache: "force-cache"})
          .then(response => {
            if (!response.ok) throw new Error("Audio HTTP " + response.status + ": " + url);
            return response.arrayBuffer();
          })
          .then(data => ctx.decodeAudioData(data))
          .catch(error => { buffers.delete(url); throw error; }));
      }
      return buffers.get(url);
    }
    function play(url, options = {}) {
      if (muted) return;
      (async () => {
        if (ctx.state === "suspended") await ctx.resume();
        const buffer = await load(url);
        if (muted) return;
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, Number(options.gain ?? 1)) * (options.balanceShot ? (shotLevels[url.split("/").at(-1)] ?? 1) : 1);
        source.buffer = buffer;
        source.connect(gain);
        if (typeof ctx.createStereoPanner === "function") {
          const pan = ctx.createStereoPanner();
          pan.pan.value = Math.max(-1, Math.min(1, Number(options.pan) || 0));
          gain.connect(pan);
          pan.connect(master);
        } else {
          gain.connect(master);
        }
        source.start(0);
      })().catch(() => {
        if (!muted && typeof options.fallback === "function") options.fallback();
      });
    }
    window.__bcRegisterWeaponShot27 = (weaponId, normalPath, suppressedPath, gain = 0.62) => {
      const id = String(weaponId || "").toLowerCase();
      if (!id || !normalPath) throw new Error("Weapon audio requires an id and clip");
      weapons.set(id, {
        normal: absolute(normalPath),
        suppressed: absolute(suppressedPath || normalPath),
        gain
      });
    };
    window.__bcPlayClip27 = (path, options) => play(absolute(path), options);
    window.__bcRegisterWeaponShot27("mk14", "assets/mk14-single-v2-25.mp3", "assets/mk14-suppressed-v2-25.mp3", 1);
    audio.gunshot = options => {
      options = options || {};
      if (options.eventKey) {
        const now = performance.now();
        const last = seen.get(options.eventKey);
        if (last && now - last < 1500) return;
        seen.set(options.eventKey, now);
        if (seen.size > 512) {
          for (const [key, at] of seen) if (now - at > 1500) seen.delete(key);
        }
      }
      const id = String(options.weaponId || "").toLowerCase();
      for (const [key, clips] of weapons) {
        if (id === key || id.startsWith(key + "-")) {
          const url = options.suppressed ? clips.suppressed : clips.normal;
          play(url, {...options, gain: clips.gain, balanceShot: true, fallback: () => originalGunshot({...options, distance: 0})});
          return;
        }
      }
      return originalGunshot({...options, distance: 0});
    };
    audio.__weaponShots30 = true;
  }

  install();
})();
