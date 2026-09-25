(() => {
  function install(tries = 0) {
    const audio = window.__peAudio;
    const register = window.__bcRegisterWeaponShot27;
    const play = window.__bcPlayClip27;
    if (!audio || !register || !play) {
      if (tries < 200) setTimeout(() => install(tries + 1), 25);
      return;
    }
    if (audio.__sampleMap28) return;
    register("akm", "assets/audio/shot-samples-v28/akm-single.mp3", "assets/audio/shot-samples-v28/akm-suppressed-single.mp3");
    register("groza", "assets/audio/shot-samples-v28/groza-single.mp3", "assets/audio/shot-samples-v28/groza-suppressed-single.mp3");
    register("beryl-m762", "assets/audio/shot-samples-v28/beryl-m762-single.mp3", "assets/audio/shot-samples-v28/beryl-m762-suppressed-single.mp3");
    register("m416", "assets/audio/shot-samples-v28/m416-single.mp3", "assets/audio/shot-samples-v28/m416-suppressed-single.mp3");
    register("mk47-mutant", "assets/audio/shot-samples-v28/mk47-mutant-single.mp3", "assets/audio/shot-samples-v28/mk47-mutant-suppressed-single.mp3");
    register("m16a4", "assets/audio/shot-samples-v28/m16a4-single.mp3", "assets/audio/shot-samples-v28/m16a4-suppressed-single.mp3");
    register("scar-l", "assets/audio/shot-samples-v28/scar-l-single.mp3", "assets/audio/shot-samples-v28/scar-l-suppressed-single.mp3");
    register("aug", "assets/audio/shot-samples-v28/aug-single.mp3", "assets/audio/shot-samples-v28/aug-suppressed-single.mp3");
    register("qbz", "assets/audio/shot-samples-v28/qbz-single.mp3", "assets/audio/shot-samples-v28/qbz-suppressed-single.mp3");
    register("g36c", "assets/audio/shot-samples-v28/g36c-single.mp3", "assets/audio/shot-samples-v28/g36c-suppressed-single.mp3");
    register("famas", "assets/audio/shot-samples-v28/famas-single.mp3", "assets/audio/shot-samples-v28/famas-suppressed-single.mp3");
    register("asm-abakan", "assets/audio/shot-samples-v28/asm-abakan-single.mp3", "assets/audio/shot-samples-v28/asm-abakan-suppressed-single.mp3");
    register("mini-14", "assets/audio/shot-samples-v28/mini-14-single.mp3", "assets/audio/shot-samples-v28/mini-14-suppressed-single.mp3");
    register("mk12", "assets/audio/shot-samples-v28/mk12-single.mp3", "assets/audio/shot-samples-v28/mk12-suppressed-single.mp3");
    register("qbu", "assets/audio/shot-samples-v28/qbu-single.mp3", "assets/audio/shot-samples-v28/qbu-suppressed-single.mp3");
    register("sks", "assets/audio/shot-samples-v28/sks-single.mp3", "assets/audio/shot-samples-v28/sks-suppressed-single.mp3");
    register("slr", "assets/audio/shot-samples-v28/slr-single.mp3", "assets/audio/shot-samples-v28/slr-suppressed-single.mp3");
    register("vss", "assets/audio/shot-samples-v28/vss-single.mp3", "assets/audio/shot-samples-v28/vss-single.mp3");
    register("kar98k", "assets/audio/shot-samples-v28/kar98k-single.mp3", "assets/audio/shot-samples-v28/kar98k-suppressed-single.mp3");
    register("m24", "assets/audio/shot-samples-v28/m24-single.mp3", "assets/audio/shot-samples-v28/m24-suppressed-single.mp3");
    register("awm", "assets/audio/shot-samples-v28/awm-single.mp3", "assets/audio/shot-samples-v28/awm-suppressed-single.mp3");
    register("win94", "assets/audio/shot-samples-v28/win94-single.mp3", "assets/audio/shot-samples-v28/win94-single.mp3");
    register("micro-uzi", "assets/audio/shot-samples-v28/micro-uzi-single.mp3", "assets/audio/shot-samples-v28/micro-uzi-suppressed-single.mp3");
    register("ump", "assets/audio/shot-samples-v28/ump-single.mp3", "assets/audio/shot-samples-v28/ump-suppressed-single.mp3");
    register("tommy-gun", "assets/audio/shot-samples-v28/tommy-gun-single.mp3", "assets/audio/shot-samples-v28/tommy-gun-suppressed-single.mp3");
    register("vector", "assets/audio/shot-samples-v28/vector-single.mp3", "assets/audio/shot-samples-v28/vector-suppressed-single.mp3");
    register("mp5k", "assets/audio/shot-samples-v28/mp5k-single.mp3", "assets/audio/shot-samples-v28/mp5k-suppressed-single.mp3");
    register("pp19-bizon", "assets/audio/shot-samples-v28/pp19-bizon-single.mp3", "assets/audio/shot-samples-v28/pp19-bizon-suppressed-single.mp3");
    register("p90", "assets/audio/shot-samples-v28/p90-single.mp3", "assets/audio/shot-samples-v28/p90-single.mp3");
    register("s1897", "assets/audio/shot-samples-v28/s1897-single.mp3", "assets/audio/shot-samples-v28/s1897-single.mp3");
    register("s686", "assets/audio/shot-samples-v28/s686-single.mp3", "assets/audio/shot-samples-v28/s686-single.mp3");
    register("s12k", "assets/audio/shot-samples-v28/s12k-single.mp3", "assets/audio/shot-samples-v28/s12k-suppressed-single.mp3");
    register("dbs", "assets/audio/shot-samples-v28/dbs-single.mp3", "assets/audio/shot-samples-v28/dbs-single.mp3");
    register("m249", "assets/audio/shot-samples-v28/m249-single.mp3", "assets/audio/shot-samples-v28/m249-single.mp3");
    register("mg3", "assets/audio/shot-samples-v28/mg3-single.mp3", "assets/audio/shot-samples-v28/mg3-single.mp3");
    register("dp28", "assets/audio/shot-samples-v28/dp28-single.mp3", "assets/audio/shot-samples-v28/dp28-single.mp3");
    register("crossbow", "assets/audio/shot-samples-v28/crossbow-single.mp3", "assets/audio/shot-samples-v28/crossbow-single.mp3");
    register("p92", "assets/audio/shot-samples-v28/p92-single.mp3", "assets/audio/shot-samples-v28/p92-suppressed-single.mp3");
    register("p18c", "assets/audio/shot-samples-v28/p18c-single.mp3", "assets/audio/shot-samples-v28/p18c-suppressed-single.mp3");
    register("skorpion", "assets/audio/shot-samples-v28/skorpion-single.mp3", "assets/audio/shot-samples-v28/skorpion-suppressed-single.mp3");
    register("deagle", "assets/audio/shot-samples-v28/deagle-single.mp3", "assets/audio/shot-samples-v28/deagle-single.mp3");
    register("p1911", "assets/audio/shot-samples-v28/p1911-single.mp3", "assets/audio/shot-samples-v28/p1911-suppressed-single.mp3");
    register("r45", "assets/audio/shot-samples-v28/r45-single.mp3", "assets/audio/shot-samples-v28/r45-single.mp3");
    register("r1895", "assets/audio/shot-samples-v28/r1895-single.mp3", "assets/audio/shot-samples-v28/r1895-suppressed-single.mp3");
    register("sawed-off", "assets/audio/shot-samples-v28/sawed-off-single.mp3", "assets/audio/shot-samples-v28/sawed-off-single.mp3");
    register("signal-flare", "assets/audio/shot-samples-v28/signal-flare-single.mp3", "assets/audio/shot-samples-v28/signal-flare-single.mp3");
    register("lynx-amr", "assets/audio/shot-samples-v28/lynx-amr-single.mp3", "assets/audio/shot-samples-v28/lynx-amr-single.mp3");
    register("js9", "assets/audio/shot-samples-v28/js9-single.mp3", "assets/audio/shot-samples-v28/js9-suppressed-single.mp3");
    const base = "assets/audio/shot-samples-v28/";
    function wrap(name, choose, gain) {
      if (typeof audio[name] !== "function") return;
      const fallback = audio[name].bind(audio);
      audio[name] = (...args) => play(base + choose(...args) + ".mp3",
        {gain, ...(typeof args[0] === "object" ? args[0] : {}), fallback: () => fallback(...args)});
    }
    wrap("grenadeThrow", id => id === "smoke-grenade" ? "smoke-throw"
      : id === "flashbang" ? "smoke-throw" : id === "molotov" ? "molotov-throw" : "frag-throw", 0.48);
    wrap("explosion", options => options?.kind === "flashbang" || options?.kind === "flash"
      ? "stun-explosion" : options?.kind === "molotov" || options?.kind === "fire"
      ? "molotov-explosion" : "frag-explosion", 0.6);
    wrap("smoke", () => "smoke-cloud", 0.4);
    wrap("flare", () => "flare-shot", 0.65);
    wrap("medicalUse", id => id === "bandage" ? "bandage-use"
      : id === "first-aid" ? "first-aid-use" : id === "med-kit" ? "med-kit-use"
      : id === "energy-drink" ? "energy-drink-use" : id === "painkiller"
      ? "painkiller-use" : "adrenaline-use", 0.42);
    audio.__sampleMap28 = true;
  }
  install();
})();
