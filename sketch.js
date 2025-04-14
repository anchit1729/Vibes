// Application state
let appState = {
    currentStage: 1,
    selectedMenu: null,
    selectedSubMenu: "",
    targetVibration: "",
    handPositions: [[], []],
    headAngle: 0,
    mouthOpen: false,
    handsAngle: 0,
    primitive: {
        frequency: 20,
        shape: "sine", // 'sine', 'square', 'triangle', 'sawtooth'
        oscillatorCreated: false,
        playing: false,
    },
    modifications: {
        am: {
            depth: 20,
            primitiveFrequency: 20,
            frequency: 5,
            primitiveShape: "sine",
            shape: "sine", // 'sine', 'square', 'triangle', 'sawtooth'
            oscillatorCreated: false,
            playing: false,
        },
        fm: {
            depth: 20,
            primitiveFrequency: 20,
            frequency: 5,
            primitiveShape: "sine",
            shape: "sine", // 'sine', 'square', 'triangle', 'sawtooth'
            oscillatorCreated: false,
            playing: false,
        },
    },
    envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.5,
        release: 0.5,
        playing: false,
    },
    envelopeDuration: 2,
    envelopeShape: [],
    envelopeWave: "primitive",
    envelopePlaying: false,
    numPoints: 128,
    activeSlider: null,
    hovering: false,
    pinchingState: [false, false],
    pinchedHandIndex: -1,
    adsrState: 1,
};

let stretching_positions = [[], []];
let isDragging = false;

// Circle positions and sizes
let circles = {
    primitive: {
        x: 200,
        y: 300,
        r: 80,
        color: [255, 100, 100],
        name: "primitive",
    },
    synthesis: {
        x: 400,
        y: 300,
        r: 80,
        color: [100, 255, 100],
        name: "synthesis",
    },
    envelope: {
        x: 600,
        y: 300,
        r: 80,
        color: [100, 100, 255],
        name: "envelope",
    },
    fm: {
        x: 400,
        y: 300,
        r: 80,
        color: [100, 100, 255],
        name: "fm",
    },
    am: {
        x: 600,
        y: 300,
        r: 80,
        color: [100, 255, 100],
        name: "am",
    },
};

// Sound objects
let primitiveOscillator;
let modulatorOscillator;
let modulationDepth;
let playing = false;
let lastPlayTime = 0;
const playInterval = 4000; // 2 seconds play, 2 seconds silence
let audioContext;
let gainNode;
let envelopeNode;
let modulatedSynthDisabled = false;

// Hand tracking with ml5.js
let video;
let hand_tracking;
let tracking_predictions = [];
let agents = [];
let savedAgents = [];
let envelopeTimeout = null;

function preload() {
    hand_tracking = ml5.handPose(
        // model options
        {
            flipped: true, // mirror the predictions to match video
            maxHands: 2,
            modelType: "full",
        },
        // callback when loaded
        () => {
            console.log("🚀 model loaded");
        }
    );
}

let viewAlpha = 0;

function setupHapticFeedback() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // // Create a gain node for volume control
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0.9; // Set volume to 30%
    gainNode.connect(audioContext.destination);

    // Create envelope gain node (will be controlled by our custom envelope)
    envelopeNode = audioContext.createGain();
    envelopeNode.gain.value = 0; // Start silent
    envelopeNode.connect(gainNode);
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    background(0);
    textFont("-apple-system"); // Use San Francisco

    setupHapticFeedback();
    createDefaultADSR();

    video = createCapture(VIDEO, { flipped: false });
    video.size(windowWidth, windowHeight);
    // Hide the video element, and just show the canvas
    video.hide();

    // set the detection callback
    hand_tracking.detectStart(video, (results) => {
        // console.log(`✋ ${results.length} hands detected`);
        tracking_predictions = results;
    });

    // fix up the circle positions
    circles.primitive.x = windowWidth / 4;
    circles.primitive.y = windowHeight / 2;
    circles.synthesis.x = windowWidth / 3;
    circles.synthesis.y = windowHeight / 2;
    circles.envelope.x = (2 * windowWidth) / 3;
    circles.envelope.y = windowHeight / 2;
    circles.am.x = windowWidth / 2;
    circles.am.y = windowHeight / 2;
    circles.fm.x = (3 * windowWidth) / 4;
    circles.fm.y = windowHeight / 2;

    // fix up the target vibration
    appState.targetVibration = getRandomVibration();

    // prep agents for visualization
    setupAgents();
}

function setupAgents() {
    // compute the grid positions of the dots
    const numRows = 5;
    const numCols = 15;
    const xStep = width / numCols;
    const yStep = height / numRows;
    for (agent of savedAgents) {
        agents.push(agent);
    }
    for (let i = 0; i < 75; i++) {
        agents.push(new Agent((i / 5) * xStep, (i % 5) * yStep));
    }
}

function draw() {
    background(0);
    noStroke();

    for (agent of agents) {
        agent.update();
        agent.display();
    }

    switch (appState.currentStage) {
        case 1:
            renderStage1();
            break;
        case 2:
            renderStage2();
            break;
        case 3:
            if (appState.selectedSubMenu === "am") {
                renderAMSynthesis();
            } else if (appState.selectedSubMenu === "fm") {
                renderFMSynthesis();
            } else {
                renderStage3();
            }
            break;
        case 4:
            renderADSREnvelope();
            break;
    }

    // set up hand tracking cursor on top of the base menu drawing
    tracking_predictions.forEach((hand, i) => {
        drawKeypoints(hand, i);
        checkForPinch(hand, i);
    });

    // set up haptic feedback playback based on the current app state
    if (frameCount !== 0) {
        renderHapticFeedback();
    }
    viewAlpha = min(255, viewAlpha + 3);
}

function applySavedEnvelope(agent) {
    if (envelopeTimeout) {
        clearTimeout(envelopeTimeout);
        envelopeTimeout = null;
    }
    let currentTime = audioContext.currentTime;
    envelopeNode.gain.cancelScheduledValues(currentTime);
    envelopeNode.gain.setValueAtTime(0, currentTime);
    let baseTime = currentTime;
    let timeIncrement = appState.envelopeDuration / appState.numPoints;
    for (let i = 0; i < appState.numPoints; i++) {
        let time = baseTime + i * timeIncrement;
        envelopeNode.gain.linearRampToValueAtTime(agent.envelope[i], time);
    }
    envelopeTimeout = setTimeout(() => {
        // if (appState.envelopePlaying) {
        //     applySavedEnvelope();
        // }
        if (primitiveOscillator) primitiveOscillator.stop();
        if (modulatorOscillator) modulatorOscillator.stop();
        primitiveOscillator = null;
        modulatorOscillator = null;
        modulationDepth = null;
        appState.envelopePlaying = false;
        stopEnvelope();
    }, appState.envelopeDuration * 1000);
}

function renderHapticFeedback() {
    switch (appState.currentStage) {
        // case 1:
        //     if (frameCount % 120 === 0) playADSRWaveForm();
        //     break;
        case 2:
            // loop primitive waveform with defined frequency
            if (frameCount % 120 === 0) playPrimitiveWaveForm();
            break;
        case 3:
            // check submenu
            if (
                appState.selectedSubMenu === "am" &&
                ((!modulatedSynthDisabled && frameCount % 120 === 0) ||
                    (modulatedSynthDisabled && frameCount % 10 === 0))
            ) {
                playAMWaveForm();
            } else if (
                appState.selectedSubMenu === "fm" &&
                ((!modulatedSynthDisabled && frameCount % 120 === 0) ||
                    (modulatedSynthDisabled && frameCount % 10 === 0))
            ) {
                playFMWaveForm();
            }
            break;
        case 4:
            // play ADSR loop
            if (frameCount % 120 === 0) playADSRWaveForm();
    }
}

function applyEnvelope() {
    if (envelopeTimeout) {
        clearTimeout(envelopeTimeout);
        envelopeTimeout = null;
    }
    let currentTime = audioContext.currentTime;
    envelopeNode.gain.cancelScheduledValues(currentTime);
    envelopeNode.gain.setValueAtTime(0, currentTime);
    let baseTime = currentTime;
    let timeIncrement = appState.envelopeDuration / appState.numPoints;
    for (let i = 0; i < appState.numPoints; i++) {
        let time = baseTime + i * timeIncrement;
        envelopeNode.gain.linearRampToValueAtTime(
            appState.envelopeShape[i],
            time
        );
    }
    envelopeTimeout = setTimeout(() => {
        if (appState.envelopePlaying) {
            applyEnvelope();
        }
    }, appState.envelopeDuration * 1000);
}

function playADSRWaveForm() {
    console.log("ADSR function reached.");
    if (!appState.envelopePlaying) {
        stopEnvelope();
        if (primitiveOscillator) {
            primitiveOscillator.stop();
            primitiveOscillator = null;
        }
        if (modulatorOscillator) {
            modulatorOscillator.stop();
            modulatorOscillator = null;
        }
        createPrimitiveOscillator();
        primitiveOscillator.loop = true;
        primitiveOscillator.connect(envelopeNode);
        primitiveOscillator.start();
        appState.envelopePlaying = true;
        switch (appState.envelopeWave) {
            case "primitive":
                appState.primitive.playing = true;
                appState.modifications.fm.playing = false;
                appState.modifications.am.playing = false;
                applyEnvelope();
                break;
            case "am":
                primitiveOscillator.frequency.value =
                    appState.modifications.am.primitiveFrequency;
                createAMOscillator();
                appState.modifications.am.playing = true;
                appState.primitive.playing = true;
                modulatorOscillator.loop = false;
                modulatorOscillator.start();
                applyEnvelope();
                break;
            case "fm":
                primitiveOscillator.frequency.value =
                    appState.modifications.fm.primitiveFrequency;
                createFMOscillator();
                appState.modifications.fm.playing = true;
                appState.primitive.playing = true;

                modulatorOscillator.loop = false;
                modulatorOscillator.start();
                applyEnvelope();
                break;
        }
    }
}

function playAMWaveForm() {
    if (!appState.modifications.am.playing) {
        createPrimitiveOscillator();
        createAMOscillator();
        appState.modifications.am.playing = true;
        appState.primitive.playing = true;
        primitiveOscillator.loop = true;
        if (appState.envelopePlaying) {
            primitiveOscillator.connect(envelopeNode);
        } else {
            primitiveOscillator.connect(gainNode);
        }
        primitiveOscillator.start();
        modulatorOscillator.loop = true;
        modulatorOscillator.start();
        modulatedSynthDisabled = false;
    } else {
        appState.primitive.playing = false;
        appState.modifications.am.playing = false;
        primitiveOscillator.stop();
        primitiveOscillator = null;
        modulatorOscillator.stop();
        modulatorOscillator = null;
        modulationDepth = null;
        modulatedSynthDisabled = true;
    }
}

function playFMWaveForm() {
    if (!appState.modifications.fm.playing) {
        createPrimitiveOscillator();
        createFMOscillator();
        appState.modifications.fm.playing = true;
        appState.primitive.playing = true;
        primitiveOscillator.loop = true;
        if (appState.envelopePlaying) {
            primitiveOscillator.connect(envelopeNode);
        } else {
            primitiveOscillator.connect(gainNode);
        }
        primitiveOscillator.start();
        modulatorOscillator.loop = true;
        modulatorOscillator.start();
        modulatedSynthDisabled = false;
    } else {
        appState.primitive.playing = false;
        appState.modifications.fm.playing = false;
        primitiveOscillator.stop();
        primitiveOscillator = null;
        modulatorOscillator.stop();
        modulatorOscillator = null;
        modulationDepth = null;
        modulatedSynthDisabled = true;
    }
}

function createModifiedFMOscillator(agent) {
    if (primitiveOscillator) {
        primitiveOscillator.frequency.value = agent.baseFrequency;
        primitiveOscillator.type = agent.waveType;
    }
    if (modulatorOscillator) {
        // modulatorOscillator.stop();
        // modulatorOscillator = null;
        modulatorOscillator = audioContext.createOscillator();
        modulatorOscillator.frequency.setValueAtTime(
            agent.modulatorFrequency,
            audioContext.currentTime
        );
        modulatorOscillator.type = agent.waveType;
        modulationDepth = audioContext.createGain();
        modulationDepth.gain.setValueAtTime(
            appState.modifications.fm.depth,
            audioContext.currentTime
        );
        modulatorOscillator.connect(modulationDepth);
        modulationDepth.connect(primitiveOscillator.frequency);
        return;
    }
    modulatorOscillator = audioContext.createOscillator();
    modulatorOscillator.frequency.setValueAtTime(
        agent.modulatorFrequency,
        audioContext.currentTime
    );
    modulatorOscillator.type = agent.waveType;
    modulationDepth = audioContext.createGain();
    modulationDepth.gain.setValueAtTime(
        appState.modifications.fm.depth,
        audioContext.currentTime
    );
    modulatorOscillator.connect(modulationDepth);
    modulationDepth.connect(primitiveOscillator.frequency);
    // primitiveOscillator.connect(gainNode);
    return;
}

function createFMOscillator() {
    if (primitiveOscillator) {
        primitiveOscillator.frequency.value =
            appState.modifications.fm.primitiveFrequency;
        primitiveOscillator.type = appState.modifications.fm.shape;
    }
    if (modulatorOscillator) {
        // modulatorOscillator.stop();
        // modulatorOscillator = null;
        modulatorOscillator = audioContext.createOscillator();
        modulatorOscillator.frequency.setValueAtTime(
            appState.modifications.fm.frequency,
            audioContext.currentTime
        );
        modulatorOscillator.type = appState.modifications.fm.shape;
        modulationDepth = audioContext.createGain();
        modulationDepth.gain.setValueAtTime(
            appState.modifications.fm.depth,
            audioContext.currentTime
        );
        modulatorOscillator.connect(modulationDepth);
        modulationDepth.connect(primitiveOscillator.frequency);
        return;
    }
    modulatorOscillator = audioContext.createOscillator();
    modulatorOscillator.frequency.setValueAtTime(
        appState.modifications.fm.frequency,
        audioContext.currentTime
    );
    modulatorOscillator.type = appState.modifications.fm.shape;
    modulationDepth = audioContext.createGain();
    modulationDepth.gain.setValueAtTime(
        appState.modifications.fm.depth,
        audioContext.currentTime
    );
    modulatorOscillator.connect(modulationDepth);
    modulationDepth.connect(primitiveOscillator.frequency);
    // primitiveOscillator.connect(gainNode);
    return;
}

function createModifiedAMOscillator(agent) {
    if (primitiveOscillator) {
        primitiveOscillator.frequency.value = agent.baseFrequency;
        primitiveOscillator.type = agent.waveType;
    }
    if (modulatorOscillator) {
        // modulatorOscillator.stop();
        // modulatorOscillator = null;
        modulatorOscillator.type = agent.waveType;
        modulatorOscillator.frequency.value = agent.modulatorFrequency;
        modulationDepth = audioContext.createGain();
        modulationDepth.gain.setValueAtTime(8, audioContext.currentTime);
        modulatorOscillator.connect(modulationDepth);
        modulationDepth.connect(primitiveOscillator.frequency);
        return;
    }
    modulatorOscillator = audioContext.createOscillator();
    modulatorOscillator.type = agent.waveType;
    modulatorOscillator.frequency.value = agent.modulatorFrequency;
    modulationDepth = audioContext.createGain();
    modulationDepth.gain.setValueAtTime(8, audioContext.currentTime);
    modulatorOscillator.connect(modulationDepth);
    modulationDepth.connect(primitiveOscillator.frequency);
    // primitiveOscillator.connect(gainNode);
}

function createAMOscillator() {
    if (primitiveOscillator) {
        primitiveOscillator.frequency.value =
            appState.modifications.am.primitiveFrequency;
        primitiveOscillator.type = appState.modifications.am.shape;
    }
    if (modulatorOscillator) {
        // modulatorOscillator.stop();
        // modulatorOscillator = null;
        modulatorOscillator.type = appState.modifications.am.shape;
        modulatorOscillator.frequency.value =
            appState.modifications.am.frequency;
        modulationDepth = audioContext.createGain();
        modulationDepth.gain.setValueAtTime(8, audioContext.currentTime);
        modulatorOscillator.connect(modulationDepth);
        modulationDepth.connect(primitiveOscillator.frequency);
        return;
    }
    modulatorOscillator = audioContext.createOscillator();
    modulatorOscillator.type = appState.modifications.am.shape;
    modulatorOscillator.frequency.value = appState.modifications.am.frequency;
    modulationDepth = audioContext.createGain();
    modulationDepth.gain.setValueAtTime(8, audioContext.currentTime);
    modulatorOscillator.connect(modulationDepth);
    modulationDepth.connect(primitiveOscillator.frequency);
    // primitiveOscillator.connect(gainNode);
}

function createModifiedPrimitiveOscillator(agent) {
    if (primitiveOscillator) {
        // primitiveOscillator.stop();
        // primitiveOscillator = null;
        primitiveOscillator.type = agent.waveType;
        primitiveOscillator.frequency.value = agent.baseFrequency;
        return;
    }
    primitiveOscillator = audioContext.createOscillator();
    primitiveOscillator.type = agent.waveType;
    primitiveOscillator.frequency.value = agent.baseFrequency;
    // primitiveOscillator.connect(gainNode);
    appState.primitive.oscillatorCreated = true;
}

function createPrimitiveOscillator() {
    if (primitiveOscillator) {
        // primitiveOscillator.stop();
        // primitiveOscillator = null;
        primitiveOscillator.type = appState.primitive.shape;
        primitiveOscillator.frequency.value = appState.primitive.frequency;
        return;
    }
    primitiveOscillator = audioContext.createOscillator();
    primitiveOscillator.type = appState.primitive.shape;
    primitiveOscillator.frequency.value = appState.primitive.frequency;
    // primitiveOscillator.connect(gainNode);
    appState.primitive.oscillatorCreated = true;
}

function playPrimitiveWaveForm() {
    if (!appState.primitive.playing) {
        appState.primitive.playing = true;
        if (primitiveOscillator) {
            primitiveOscillator.stop();
            primitiveOscillator = null;
        }
        createPrimitiveOscillator();
        primitiveOscillator.loop = false;
        primitiveOscillator.frequency.value = appState.primitive.frequency;
        primitiveOscillator.type = appState.primitive.shape;
        primitiveOscillator.connect(gainNode);
        primitiveOscillator.start();
    } else {
        appState.primitive.playing = false;
        primitiveOscillator.loop = false;
        primitiveOscillator.stop();
        primitiveOscillator = null;
    }
}

function isVowel(character) {
    switch (character) {
        case "a":
        case "A":
        case "e":
        case "E":
        case "i":
        case "I":
        case "o":
        case "O":
        case "u":
        case "U":
            return true;
        default:
            return false;
    }
}

function renderStage1() {
    // draw title and prompt
    fill(255, viewAlpha);
    textSize(24);
    textAlign(CENTER);
    // text("Interactive Vibration Explorer", width / 2, 50);

    textSize(24);
    text(
        "Move your hands around to interact, pinch to select, and start creating",
        width / 2,
        50
    );
    textSize(18);
    text(
        `What does ${isVowel(appState.targetVibration[0]) ? "an" : "a"} ${
            appState.targetVibration
        } vibration feel like?`,
        width / 2,
        90
    );

    // textSize(24);
    // text("Try touching the white box", width / 2, height - 50);

    fill(255, viewAlpha);

    // Draw three circles
    for (const [key, circle] of Object.entries(circles)) {
        if (
            circle.name === "fm" ||
            circle.name === "am" ||
            circle.name === "primitive"
        ) {
            continue;
        }
        let distance = 100000;
        for (position of appState.handPositions) {
            if (position.length > 0)
                distance = min(
                    distance,
                    dist(position[0], position[1], circle.x, circle.y)
                );
        }
        appState.hovering = distance < circle.r;

        // Highlight if hovering
        fill(0, viewAlpha);
        stroke(
            !appState.hovering ? 255 : circle.color[0],
            !appState.hovering ? 255 : circle.color[1],
            !appState.hovering ? 255 : circle.color[2],
            viewAlpha
        );

        ellipse(circle.x, circle.y, circle.r * 2);

        // Label
        fill(
            !appState.hovering ? 255 : circle.color[0],
            !appState.hovering ? 255 : circle.color[1],
            !appState.hovering ? 255 : circle.color[2],
            viewAlpha
        );
        textSize(16);
        text(key, circle.x, circle.y);

        // Check for selection
        if (appState.hovering && appState.pinchedHandIndex !== -1) {
            const selection_dist = dist(
                appState.handPositions[appState.pinchedHandIndex][0],
                appState.handPositions[appState.pinchedHandIndex][1],
                circle.x,
                circle.y
            );
            if (selection_dist < circle.r) {
                // console.log(
                //     "Selection distance check cleared: " + selection_dist
                // );
                // if (circle.name === "primitive") {
                //     appState.currentStage = 2;}
                if (circle.name === "synthesis") {
                    appState.selectedSubMenu = "";
                    appState.currentStage = 3;
                } else if (circle.name === "envelope") {
                    appState.currentStage = 4;
                }
                viewAlpha = 0;
                if (appState.envelopePlaying) stopEnvelope();
            }
        }
    }
}

function renderStage2() {
    // Draw title and prompt
    fill(255, viewAlpha);
    textSize(24);
    textAlign(CENTER);
    text("Primitive", width / 2, 50);

    textSize(18);
    text("Try compressing or stretching the wave...", width / 2, 90);

    // Draw waveform
    drawWaveform(
        appState.primitive.shape,
        height / 2,
        appState.primitive.frequency
    );

    // // Draw frequency slider
    // drawFrequencySlider();

    // Draw shape options
    drawShapeOptions(appState.primitive, "primitive", width / 2 - 240, 150);

    // Draw back button
    drawModifiedBackButton();

    for (position of appState.handPositions) {
        if (
            pinching_right_now &&
            appState.handPositions[appState.pinchedHandIndex] === position &&
            position[1] < height / 2 + 100 &&
            position[1] > height / 2 - 100
        ) {
            appState.primitive.frequency = max(
                0,
                map(position[0], 0, width, 200, 0)
            );
        }
    }
}

function calculateAngle(point1, point2) {
    return atan2(point2[1] - point1[1], point2[0] - point1[0]);
}

function renderStage3() {
    // Draw title and prompt
    fill(255, viewAlpha);
    textSize(24);
    textAlign(CENTER);
    text("Synthesis", width / 2, 50);

    textSize(18);
    text(
        `What does ${isVowel(appState.targetVibration[0]) ? "an" : "a"} ${
            appState.targetVibration
        } vibration feel like?`,
        width / 2,
        90
    );

    for (const [key, circle] of Object.entries(circles)) {
        if (circle.name === "synthesis" || circle.name === "envelope") {
            continue;
        }
        let distance = 100000;
        for (position of appState.handPositions) {
            if (position.length > 0)
                distance = min(
                    distance,
                    dist(position[0], position[1], circle.x, circle.y)
                );
        }
        appState.hovering = distance < circle.r;

        // Highlight if hovering
        fill(0, viewAlpha);
        stroke(
            !appState.hovering ? 255 : circle.color[0],
            !appState.hovering ? 255 : circle.color[1],
            !appState.hovering ? 255 : circle.color[2],
            viewAlpha
        );

        ellipse(circle.x, circle.y, circle.r * 2);

        // Label
        fill(
            !appState.hovering ? 255 : circle.color[0],
            !appState.hovering ? 255 : circle.color[1],
            !appState.hovering ? 255 : circle.color[2],
            viewAlpha
        );
        textSize(16);
        text(key, circle.x, circle.y);

        // Check for selection
        if (appState.hovering && appState.pinchedHandIndex !== -1) {
            const selection_dist = dist(
                appState.handPositions[appState.pinchedHandIndex][0],
                appState.handPositions[appState.pinchedHandIndex][1],
                circle.x,
                circle.y
            );
            if (selection_dist < circle.r && viewAlpha === 255) {
                // console.log(
                //     "Selection distance check cleared: " + selection_dist
                // );
                if (circle.name === "primitive") {
                    appState.currentStage = 2;
                    appState.selectedSubMenu = "";
                } else if (circle.name === "am") {
                    appState.selectedSubMenu = "am";
                    appState.currentStage = 3;
                } else if (circle.name === "fm") {
                    appState.selectedSubMenu = "fm";
                    appState.currentStage = 3;
                }
                viewAlpha = 0;
            }
        }
    }

    // Draw back button
    drawBackButton();
}

function drawWaveform(
    waveShape,
    yPosition,
    frequency,
    strokeColor = color(255)
) {
    // Draw a visual representation of the current waveform
    stroke(strokeColor, viewAlpha);
    strokeWeight(3);
    noFill();
    beginShape();
    const waveHeight = 40;
    const cycles = frequency / 5; // Adjust the visuals based on frequency

    for (let x = 0; x < width; x++) {
        let y = 0;
        const t = map(x, 0, width, 0, TWO_PI * cycles);

        switch (waveShape) {
            case "sine":
                y = sin(t);
                break;
            case "square":
                y = sin(t) >= 0 ? 1 : -1;
                break;
            case "triangle":
                y = (asin(sin(t)) * 2) / PI;
                break;
            case "sawtooth":
                y = ((t % TWO_PI) / TWO_PI) * 2 - 1;
                break;
        }

        vertex(x, yPosition + y * waveHeight);
    }
    endShape();
}

function drawAMWaveform(
    carrierShape,
    carrierFreq,
    modShape,
    modFreq,
    modDepth
) {
    stroke(255, 200, 200, viewAlpha);
    strokeWeight(1);
    noFill();
    beginShape();
    const waveHeight = 26;
    const carrierCycles = carrierFreq / 10;
    const modCycles = modFreq / 10;

    for (let x = 0; x < width; x++) {
        const t = map(x, 0, width, 0, TWO_PI * carrierCycles);
        const mt = map(x, 0, width, 0, TWO_PI * modCycles);

        // Calculate modulator value
        let modVal = 0;
        switch (modShape) {
            case "sine":
                modVal = sin(mt);
                break;
            case "square":
                modVal = sin(mt) >= 0 ? 1 : -1;
                break;
            case "triangle":
                modVal = (asin(sin(mt)) * 2) / PI;
                break;
            case "sawtooth":
                modVal = ((mt % TWO_PI) / TWO_PI) * 2 - 1;
                break;
        }

        // Calculate carrier value
        let carrierVal = 0;
        switch (carrierShape) {
            case "sine":
                carrierVal = sin(t);
                break;
            case "square":
                carrierVal = sin(t) >= 0 ? 1 : -1;
                break;
            case "triangle":
                carrierVal = (asin(sin(t)) * 2) / PI;
                break;
            case "sawtooth":
                carrierVal = ((t % TWO_PI) / TWO_PI) * 2 - 1;
                break;
        }

        // Apply amplitude modulation
        const ampMod = 1 + (modVal * modDepth) / 10;
        const y = carrierVal * ampMod;

        vertex(x, (3 * height) / 4 + 130 + y * waveHeight);
    }
    endShape();
}

function drawFrequencySlider() {
    // Draw frequency slider
    fill(150);
    rect(width / 2 - 200, height / 4, 400, 30, 15);

    // Draw slider handle
    const handlePos = map(
        appState.primitive.frequency,
        1,
        500,
        width / 2 - 200,
        width / 2 + 200
    );
    fill(255);
    ellipse(handlePos, height / 4 + 20, 40);

    fill(0);
    textAlign(CENTER);
    text("Frequency: " + round(appState.primitive.frequency) + " Hz", 400, 370);
}

function drawShapeOptions(targetObj, targetType, startX = 200, startY = 420) {
    const shapes = ["sine", "square", "triangle", "sawtooth"];
    const shapeBoxes = [];

    for (let i = 0; i < shapes.length; i++) {
        const x = startX + i * 120;
        const y = startY;
        const w = 100;
        const h = 80;

        // Draw box
        fill(0);
        stroke(targetObj.shape === shapes[i] ? 255 : 80, viewAlpha);
        rect(x, y, w, h, 10);

        // Draw shape icon
        stroke(255, viewAlpha);
        noFill();
        beginShape();
        for (let j = 0; j < 20; j++) {
            const t = map(j, 0, 19, 0, TWO_PI);
            let yVal = 0;

            switch (shapes[i]) {
                case "sine":
                    yVal = sin(t);
                    break;
                case "square":
                    yVal = sin(t) >= 0 ? 1 : -1;
                    break;
                case "triangle":
                    yVal = (asin(sin(t)) * 2) / PI;
                    break;
                case "sawtooth":
                    yVal = ((t % TWO_PI) / TWO_PI) * 2 - 1;
                    break;
            }

            vertex(x + 30 + j * 2, y + 40 + yVal * 20);
        }
        endShape();

        // Store box for interaction detection
        shapeBoxes.push({ x, y, w, h, shape: shapes[i] });
    }

    // Check for selection
    for (const box of shapeBoxes) {
        for (position of appState.handPositions) {
            if (
                ((appState.pinchingState[0] &&
                    appState.handPositions[0] === position) ||
                    (appState.pinchingState[1] &&
                        appState.handPositions[1] === position)) &&
                isInside(position, box)
            ) {
                if (targetType === "primitive") {
                    targetObj.shape = box.shape;
                    // update oscillator shape
                } else if (targetType === "am") {
                    targetObj.shape = box.shape;
                    // update oscillator shape
                } else if (targetType === "fm") {
                    targetObj.shape = box.shape;
                }
            }
        }
    }
}

function drawModifiedBackButton() {
    // Draw back button
    noFill();
    stroke(200, viewAlpha);
    const backButton = { x: 50, y: 150, w: 100, h: 100 };
    rect(backButton.x, backButton.y, backButton.w, backButton.h, 10);

    fill(255, viewAlpha);
    textAlign(CENTER, CENTER);
    textSize(18);
    text("←", backButton.x + backButton.w / 2, backButton.y + backButton.h / 2);

    // Check for selection
    for (position of appState.handPositions) {
        if (
            viewAlpha === 255 &&
            ((appState.pinchingState[0] &&
                appState.handPositions[0] === position) ||
                (appState.pinchingState[1] &&
                    appState.handPositions[1] === position)) &&
            isInside(position, backButton)
        ) {
            appState.currentStage = 3;
            appState.selectedSubMenu = "";
            print("triggered modified back");
            appState.selectedMenu = null;
            if (primitiveOscillator) primitiveOscillator.stop();
            if (modulatorOscillator) modulatorOscillator.stop();
            primitiveOscillator = null;
            modulatorOscillator = null;
            modulationDepth = null;
            appState.primitive.playing = false;
            appState.modifications.am.playing = false;
            appState.modifications.fm.playing = false;
            appState.envelopePlaying = false;
            stopEnvelope();
            viewAlpha = 0;
            appState.pinchingState[0] = false;
            appState.pinchingState[1] = false;
            pinching_right_now = false;
            strokeWeight(1);
        }
    }
}

function drawBackButton() {
    // Draw back button
    noFill();
    stroke(200, viewAlpha);
    const backButton = { x: 50, y: 150, w: 100, h: 100 };
    rect(backButton.x, backButton.y, backButton.w, backButton.h, 10);

    fill(255, viewAlpha);
    textAlign(CENTER, CENTER);
    textSize(18);
    text("←", backButton.x + backButton.w / 2, backButton.y + backButton.h / 2);

    // Check for selection
    for (position of appState.handPositions) {
        if (
            viewAlpha === 255 &&
            ((appState.pinchingState[0] &&
                appState.handPositions[0] === position) ||
                (appState.pinchingState[1] &&
                    appState.handPositions[1] === position)) &&
            isInside(position, backButton)
        ) {
            print("triggered main back");
            appState.currentStage = 1;
            appState.selectedMenu = null;
            if (primitiveOscillator) primitiveOscillator.stop();
            if (modulatorOscillator) modulatorOscillator.stop();
            primitiveOscillator = null;
            modulatorOscillator = null;
            modulationDepth = null;
            appState.primitive.playing = false;
            appState.modifications.am.playing = false;
            appState.modifications.fm.playing = false;
            appState.envelopePlaying = false;
            stopEnvelope();
            viewAlpha = 0;
            appState.pinchingState[0] = false;
            appState.pinchingState[1] = false;
            pinching_right_now = false;
            strokeWeight(1);
        }
    }
}

function drawSaveButton() {
    // Draw save button
    noFill();
    stroke(200, viewAlpha);
    const saveButton = { x: windowWidth - 120, y: 150, w: 100, h: 100 };
    rect(saveButton.x, saveButton.y, saveButton.w, saveButton.h, 10);

    fill(255, viewAlpha);
    textAlign(CENTER, CENTER);
    textSize(18);
    text(
        "Save",
        saveButton.x + saveButton.w / 2,
        saveButton.y + saveButton.h / 2
    );

    // Check for selection
    for (position of appState.handPositions) {
        if (
            viewAlpha === 255 &&
            ((appState.pinchingState[0] &&
                appState.handPositions[0] === position) ||
                (appState.pinchingState[1] &&
                    appState.handPositions[1] === position)) &&
            isInside(position, saveButton)
        ) {
            appState.currentStage = 1;
            appState.selectedMenu = null;
            if (primitiveOscillator) primitiveOscillator.stop();
            if (modulatorOscillator) modulatorOscillator.stop();
            primitiveOscillator = null;
            modulatorOscillator = null;
            modulationDepth = null;
            appState.primitive.playing = false;
            appState.modifications.am.playing = false;
            appState.modifications.fm.playing = false;
            appState.envelopePlaying = false;
            stopEnvelope();
            viewAlpha = 0;
            appState.pinchingState[0] = false;
            appState.pinchingState[1] = false;
            pinching_right_now = false;
            strokeWeight(1);

            // create a vibration record with the current adsr configuration (this is guaranteed to be valid when the button is hit)
            let vibrationRecord = null;
            if (appState.envelopeWave === "primitive") {
                vibrationRecord = new VibrationRecord(
                    appState.envelopeWave,
                    appState.envelopeShape,
                    appState.primitive.frequency
                );
            } else if (appState.envelopeWave === "am") {
                vibrationRecord = new VibrationRecord(
                    appState.envelopeWave,
                    appState.envelopeShape,
                    appState.modifications.am.primitiveFrequency,
                    appState.modifications.am.frequency
                );
            } else {
                vibrationRecord = new VibrationRecord(
                    appState.envelopeWave,
                    appState.envelopeShape,
                    appState.modifications.fm.primitiveFrequency,
                    appState.modifications.fm.frequency
                );
            }
            // assign vibration record to a special agent
            let newAgent = new Agent(
                random(100, windowWidth - 100),
                random(100, windowHeight - 100)
            );
            newAgent.clr = generateRandomColour();
            newAgent.containsSaveData = true;
            newAgent.waveType = vibrationRecord.waveformType;
            newAgent.envelope = [...vibrationRecord.envelopeCurve];
            newAgent.baseFrequency = vibrationRecord.baseFrequency;
            newAgent.modulatorFrequency = vibrationRecord.modulatorFrequency;
            viewAlpha = 0;
            appState.targetVibration = getRandomVibration();
            agents = [];
            savedAgents.push(newAgent);
            setupAgents();
            appState.envelopePlaying = false;
            createDefaultADSR();
        }
    }
}

function isInside(point, rect) {
    if (
        point[0] > rect.x &&
        point[0] < rect.x + rect.w &&
        point[1] > rect.y &&
        point[1] < rect.y + rect.h
    ) {
        return true;
    }
    return false;
}

function getRandomVibration() {
    const vibrationTypes = [
        "tick",
        "wobble",
        "ascending",
        "descending",
        "agitated",
        "happy",
        "sad",
        "relaxed",
    ];
    return random(vibrationTypes);
}

function renderAMSynthesis() {
    // Draw title and prompt
    fill(255, viewAlpha);
    textSize(24);
    textAlign(CENTER);
    text("AM", width / 2, 50);

    textSize(18);
    text(
        `What does ${isVowel(appState.targetVibration[0]) ? "an" : "a"} ${
            appState.targetVibration
        } vibration feel like?`,
        width / 2,
        90
    );

    // Draw carrier waveform
    drawWaveform(
        appState.modifications.am.primitiveShape,
        height / 4 + 130,
        appState.modifications.am.primitiveFrequency,
        color(255, 100, 100)
    );

    // Draw modulator waveform
    drawWaveform(
        appState.modifications.am.shape,
        height / 2 + 130,
        appState.modifications.am.frequency,
        color(100, 255, 100)
    );

    // Draw shape options for modulator
    drawShapeOptions(appState.modifications.am, "am", width / 2 - 240, 150);
    appState.modifications.am.primitiveShape = appState.modifications.am.shape;

    // Check for slider interaction
    if (mouseIsPressed) {
        // Check modulator frequency slider
        if (mouseY > 295 && mouseY < 325 && mouseX > 450 && mouseX < 750) {
            appState.modifications.am.frequency = map(mouseX, 450, 750, 1, 20);
        }
        // Check modulator depth slider
        if (mouseY > 375 && mouseY < 405 && mouseX > 450 && mouseX < 750) {
            appState.modifications.am.depth = map(mouseX, 450, 750, 0, 1);
        }
    }

    drawAMWaveform(
        appState.modifications.am.primitiveShape,
        appState.modifications.am.primitiveFrequency,
        appState.modifications.am.shape,
        appState.modifications.am.frequency,
        appState.modifications.am.depth
    );

    // Draw back button to modifications menu
    // drawBackButton();
    drawModifiedBackButton();

    for (position of appState.handPositions) {
        if (
            ((appState.pinchingState[0] &&
                appState.handPositions[0] === position) ||
                (appState.pinchingState[1] &&
                    appState.handPositions[1] === position)) &&
            position[1] < height / 4 + 100 + 130 &&
            position[1] > height / 4 - 100 + 130
        ) {
            appState.modifications.am.primitiveFrequency = max(
                0,
                map(position[0], 0, width, 200, 0)
            );
        } else if (
            ((appState.pinchingState[0] &&
                appState.handPositions[0] === position) ||
                (appState.pinchingState[1] &&
                    appState.handPositions[1] === position)) &&
            position[1] < height / 2 + 100 + 130 &&
            position[1] > height / 2 - 100 + 130
        ) {
            appState.modifications.am.frequency = max(
                0,
                map(position[0], 0, width, 20, 0)
            );
        }
    }
}

function renderFMSynthesis() {
    // Placeholder for FM synthesis screen
    fill(255, viewAlpha);
    textSize(24);
    textAlign(CENTER);
    text("FM", width / 2, 50);

    textSize(18);
    text(
        `What does ${isVowel(appState.targetVibration[0]) ? "an" : "a"} ${
            appState.targetVibration
        } vibration feel like?`,
        width / 2,
        90
    );

    drawWaveform(
        appState.modifications.fm.primitiveShape,
        height / 4 + 130,
        appState.modifications.fm.primitiveFrequency,
        color(255, 100, 100)
    );

    drawWaveform(
        appState.modifications.fm.shape,
        height / 2 + 130,
        appState.modifications.fm.frequency,
        color(100, 255, 100)
    );

    drawShapeOptions(appState.modifications.fm, "fm", width / 2 - 200, 150);
    appState.modifications.fm.primitiveShape = appState.modifications.fm.shape;

    drawFMWaveform(
        appState.modifications.fm.primitiveShape,
        appState.modifications.fm.primitiveFrequency,
        appState.modifications.fm.shape,
        appState.modifications.fm.frequency,
        appState.modifications.fm.depth
    );

    // Draw back button to modifications menu
    // drawBackButton();
    drawModifiedBackButton();

    for (position of appState.handPositions) {
        if (
            ((appState.pinchingState[0] &&
                appState.handPositions[0] === position) ||
                (appState.pinchingState[1] &&
                    appState.handPositions[1] === position)) &&
            position[1] < height / 4 + 130 + 100 &&
            position[1] > height / 4 - 100 + 130
        ) {
            appState.modifications.fm.primitiveFrequency = max(
                0,
                map(position[0], 0, width, 200, 0)
            );
        } else if (
            ((appState.pinchingState[0] &&
                appState.handPositions[0] === position) ||
                (appState.pinchingState[1] &&
                    appState.handPositions[1] === position)) &&
            position[1] < height / 2 + 100 + 130 &&
            position[1] > height / 2 - 100 + 130
        ) {
            appState.modifications.fm.frequency = max(
                0.0,
                map(position[0], 0, width, 20, 0)
            );
        }
    }
}

function drawFMWaveform(
    carrierShape,
    carrierFreq,
    modulatorShape,
    modulatorFreq,
    modulationIndex
) {
    push();
    noFill();
    stroke(255, viewAlpha);
    strokeWeight(1);

    beginShape();
    for (let x = 0; x < width; x++) {
        // Calculate modulator value
        let modulatorValue = 0;
        let t = map(x, 0, width, 0, 1);

        if (modulatorShape === "sine") {
            modulatorValue = sin(t * TWO_PI * modulatorFreq);
        } else if (modulatorShape === "square") {
            modulatorValue = (t * modulatorFreq) % 1 < 0.5 ? 1 : -1;
        } else if (modulatorShape === "sawtooth") {
            modulatorValue = ((t * modulatorFreq) % 1) * 2 - 1;
        } else if (modulatorShape === "triangle") {
            let phase = (t * modulatorFreq) % 1;
            modulatorValue = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
        }

        // Calculate frequency deviation
        let freqDeviation = (modulationIndex / 4) * modulatorValue;

        // Calculate carrier value with frequency modulation
        let carrierValue = 0;
        let phase = (t / 10) * TWO_PI * carrierFreq + freqDeviation;

        if (carrierShape === "sine") {
            carrierValue = sin(phase);
        } else if (carrierShape === "square") {
            carrierValue = sin(phase) >= 0 ? 1 : -1;
        } else if (carrierShape === "sawtooth") {
            carrierValue = 2 * ((phase / TWO_PI) % 1) - 1;
        } else if (carrierShape === "triangle") {
            let normalized = (phase / TWO_PI) % 1;
            carrierValue =
                normalized < 0.5 ? 4 * normalized - 1 : 3 - 4 * normalized;
        }

        // Map to screen coordinates
        let y = map(
            carrierValue,
            -1,
            1,
            height - 250 + 130,
            height - 150 + 130
        );
        vertex(x, y);
    }
    endShape();
    pop();
}

function renderADSREnvelope() {
    // Draw title and prompt
    fill(255, viewAlpha);
    textSize(24);
    textAlign(CENTER);
    text("Envelope", width / 2, 50);

    textSize(18);
    text(
        `What does ${isVowel(appState.targetVibration) ? "an" : "a"} ${
            appState.targetVibration
        } vibration feel like?`,
        width / 2,
        90
    );

    stroke(200, 100, 255, viewAlpha);
    strokeWeight(2);
    noFill();

    beginShape();
    for (let i = 0; i < appState.numPoints; i++) {
        let x = map(i, 0, appState.numPoints, 0, width);
        let y = map(
            appState.envelopeShape[i],
            0,
            1,
            height * 0.65,
            height * 0.35
        );
        vertex(x, y);
    }
    endShape();

    // Draw AM and FM options
    const primButton = {
        x: windowWidth / 4 - 100,
        y: windowHeight - 120,
        w: 200,
        h: 100,
        name: "Primitive",
    };

    const amButton = {
        x: windowWidth / 2 - 100,
        y: windowHeight - 120,
        w: 200,
        h: 100,
        name: "AM",
    };
    const fmButton = {
        x: (3 * windowWidth) / 4 - 100,
        y: windowHeight - 120,
        w: 200,
        h: 100,
        name: "FM",
    };

    let buttons = [primButton, amButton, fmButton];

    // Check for hovering and selection
    for (position of appState.handPositions) {
        if (
            ((appState.pinchingState[0] &&
                appState.handPositions[0] === position) ||
                (appState.pinchingState[1] &&
                    appState.handPositions[1] === position)) &&
            appState.handPositions[appState.pinchedHandIndex] === position &&
            position[1] > 0.3 * height &&
            position[1] < 0.7 * height
        ) {
            // tweak adsr envelope
            let index = floor(
                map(position[0], 0, width, 0, appState.numPoints)
            );
            index = constrain(index, 0, appState.numPoints - 1);

            let newValue = map(position[1], height * 0.35, height * 0.65, 1, 0);
            newValue = constrain(newValue, 0, 1);

            let radius = 8;
            for (let i = index - radius; i <= index + radius; i++) {
                if (i >= 0 && i < appState.numPoints) {
                    // Calculate the distance factor (closer points change more)
                    let factor = 1 - abs(index - i) / radius;
                    appState.envelopeShape[i] = lerp(
                        appState.envelopeShape[i],
                        newValue,
                        factor * 0.5
                    );
                }
            }
        }
    }
    strokeWeight(1);
    for (const [key, circle] of Object.entries(circles)) {
        if (circle.name === "synthesis" || circle.name === "envelope") {
            continue;
        }
        let distance = 100000;
        for (position of appState.handPositions) {
            if (position.length > 0)
                distance = min(
                    distance,
                    dist(
                        position[0],
                        position[1],
                        circle.x,
                        windowHeight - circle.r * 2 - 20
                    )
                );
        }
        appState.hovering = distance < circle.r;

        // Highlight if hovering
        fill(0, viewAlpha);
        stroke(
            appState.envelopeWave !== circle.name ? 255 : circle.color[0],
            appState.envelopeWave !== circle.name ? 255 : circle.color[1],
            appState.envelopeWave !== circle.name ? 255 : circle.color[2],
            viewAlpha
        );

        ellipse(circle.x, windowHeight - circle.r * 2 - 20, circle.r * 2);

        // Label
        fill(
            appState.envelopeWave !== circle.name ? 255 : circle.color[0],
            appState.envelopeWave !== circle.name ? 255 : circle.color[1],
            appState.envelopeWave !== circle.name ? 255 : circle.color[2],
            viewAlpha
        );
        textSize(16);
        text(key, circle.x, windowHeight - circle.r * 2 - 20);

        // Check for selection
        if (appState.hovering && appState.pinchedHandIndex !== -1) {
            const selection_dist = dist(
                appState.handPositions[appState.pinchedHandIndex][0],
                appState.handPositions[appState.pinchedHandIndex][1],
                circle.x,
                windowHeight - circle.r * 2 - 20
            );
            if (selection_dist < circle.r) {
                // console.log(
                //     "Selection distance check cleared: " + selection_dist
                // );
                if (circle.name === "primitive") {
                    console.log("Use primitive waveform with ADSR");
                    appState.envelopeWave = "primitive";
                    modulatorOscillator = null;
                    modulationDepth = null;
                    appState.envelopePlaying = false;
                    stopEnvelope();
                } else if (circle.name === "am") {
                    console.log("Use AM waveform with ADSR");
                    appState.envelopeWave = "am";
                    appState.envelopePlaying = false;
                    stopEnvelope();
                } else if (circle.name === "fm") {
                    console.log("Use FM waveform with ADSR");
                    appState.envelopeWave = "fm";
                    appState.envelopePlaying = false;
                    stopEnvelope();
                }
                // viewAlpha = 0;
            }
        }
    }

    drawBackButton();
    drawSaveButton();
}

function stopEnvelope() {
    if (envelopeTimeout) {
        clearTimeout(envelopeTimeout);
        envelopeTimeout = null;
    }
    let currentTime = audioContext.currentTime;

    // Apply release portion regardless of where we are in the envelope
    envelopeNode.gain.cancelScheduledValues(currentTime);
    let currentValue = envelopeNode.gain.value;
    envelopeNode.gain.setValueAtTime(currentValue, currentTime);

    // Create a brief release tail
    envelopeNode.gain.linearRampToValueAtTime(0, currentTime + 0.1);
}

function mousePressed() {
    // Check if the mouse is near the envelope
    if (mouseY > height * 0.1 && mouseY < height * 0.85) {
        isDragging = true;
        mouseDragged();
    }
}

function mouseDragged() {
    if (isDragging) {
        // Find the closest index to the current mouse X position
        let index = floor(map(mouseX, 0, width, 0, appState.numPoints));
        index = constrain(index, 0, appState.numPoints - 1);

        // Update the envelope at that index
        let newValue = map(mouseY, height * 0.1, height * 0.85, 1, 0);
        newValue = constrain(newValue, 0, 1);

        // Smooth the changes by updating a range around the mouse position
        let radius = 8;
        for (let i = index - radius; i <= index + radius; i++) {
            if (i >= 0 && i < appState.numPoints) {
                // Calculate the distance factor (closer points change more)
                let factor = 1 - abs(index - i) / radius;
                appState.envelopeShape[i] = lerp(
                    appState.envelopeShape[i],
                    newValue,
                    factor * 0.5
                );
            }
        }
    }
}

function mouseReleased() {
    isDragging = false;
}

function createDefaultADSR() {
    for (let i = 0; i < appState.numPoints; i++) {
        // Attack: First 10%
        if (i < appState.numPoints * 0.1) {
            appState.envelopeShape[i] = map(
                i,
                0,
                appState.numPoints * 0.1,
                0,
                1
            );
        }
        // Decay: Next 10%
        else if (i < appState.numPoints * 0.8) {
            appState.envelopeShape[i] = map(
                i,
                appState.numPoints * 0.1,
                appState.numPoints * 0.8,
                1,
                0
            );
        }
        // Sustain: Middle 50%
        else if (i < appState.numPoints * 0.9) {
            appState.envelopeShape[i] = 0.0;
        }
        // Release: Final 30%
        else {
            appState.envelopeShape[i] = map(
                i,
                appState.numPoints * 0.9,
                appState.numPoints,
                0,
                0
            );
        }
    }
}
