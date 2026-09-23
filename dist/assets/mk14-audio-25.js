(() => {
"use strict";

const normalUrl = new URL("assets/mk14-single-v2-25.mp3", document.baseURI).href;
const suppressedUrl = new URL("assets/mk14-suppressed-v2-25.mp3", document.baseURI).href;

function install(tries = 0) {
    const audio = window.__peAudio;

    if (!audio || typeof audio.gunshot !== "function") {
        if (tries < 200) setTimeout(() => install(tries + 1), 25);
        return;
    }

    if (audio.__mk14SingleShot25) return;

    const original = audio.gunshot.bind(audio);
    const AC = window.AudioContext || window.webkitAudioContext;

    if (!AC) return;

    const ctx = new AC();

    const load = async url => {
        const response = await fetch(url, {cache: "force-cache"});
        if (!response.ok) throw new Error(`MK14 audio HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        return await ctx.decodeAudioData(data);
    };

    const normal = load(normalUrl);
    const suppressed = load(suppressedUrl);

    function play(bufferPromise, options = {}) {
        if (audio.muted) return;

        (async () => {
            if (ctx.state === "suspended") {
                await ctx.resume();
            }

            const buffer = await bufferPromise;

            /* 매 발마다 새로운 source 생성 = 총알 1발당 소리 1회 */
            const source = ctx.createBufferSource();
            const gain = ctx.createGain();

            source.buffer = buffer;

            const distance = Number(options.distance);
            gain.gain.value =
                Number.isFinite(distance) && distance > 0
                    ? Math.max(0.06, Math.min(1, 1 - distance / 140))
                    : 1;

            source.connect(gain);

            if (typeof ctx.createStereoPanner === "function") {
                const panner = ctx.createStereoPanner();
                panner.pan.value = Math.max(
                    -1,
                    Math.min(1, Number(options.pan) || 0)
                );

                gain.connect(panner);
                panner.connect(ctx.destination);
            } else {
                gain.connect(ctx.destination);
            }

            source.start(0);
        })().catch(() => {
            original(options);
        });
    }

    audio.gunshot = options => {
        options = options || {};

        const id = String(options.weaponId || "").toLowerCase();

        if (id === "mk14" || id.startsWith("mk14-")) {
            play(
                options.suppressed ? suppressed : normal,
                options
            );
            return;
        }

        return original(options);
    };

    audio.__mk14SingleShot25 = true;
}

install();
})();
