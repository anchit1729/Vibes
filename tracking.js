let hand_tracking_model; // ml5 tracking
let hand_tracking_predictions = [];
let pinching_right_now = false;
let tracked_hand = null;

const colours = [
    "Red",
    "OrangeRed",
    "Gold",
    "Lime",
    "Turquoise",
    "DodgerBlue",
    "Blue",
    "DarkMagenta",
];

function checkForPinch(hand, i) {
    const index_tip_position = [
        hand["index_finger_tip"]["x"],
        hand["index_finger_tip"]["y"],
    ];
    const thumb_tip_position = [hand["thumb_tip"]["x"], hand["thumb_tip"]["y"]];
    if (
        dist(
            index_tip_position[0],
            index_tip_position[1],
            thumb_tip_position[0],
            thumb_tip_position[1]
        ) <= 35
    ) {
        pinching_right_now = true;
        // console.log("Pinch Detected.");
        if (pinching_right_now && appState.pinchingState[i] !== true) {
            tracked_hand = hand;
            appState.pinchingState[i] = true;
            appState.pinchedHandIndex = i;
        } else {
            tracked_hand = null;
            appState.pinchingState[i] = true;
            appState.pinchedHandIndex = i;
        }
    } else {
        // if (pinching_right_now) {
        //     tracked_hand = hand;
        // } else {
        //     tracked_hand = null;
        // }
        appState.pinchingState[i] = false;
        if (appState.pinchedHandIndex === i) {
            appState.pinchedHandIndex = -1;
        }
        if (!appState.pinchingState[0] && !appState.pinchingState[1]) {
            pinching_right_now = false;
        }
        // console.log("No pinch.");
        // tracked_hand = null;
    }
}

// Draw dots for all detected landmarks
function drawKeypoints(hand, i) {
    const c = color(colours[i % colours.length]);
    if (pinching_right_now && appState.pinchingState[i] === true) {
        fill(200, 100, 255);
        noStroke();
        circle(
            hand["index_finger_tip"]["x"],
            hand["index_finger_tip"]["y"],
            35
        );
    }
    fill(255);
    noStroke();

    // hand.keypoints.forEach((kp) => {
    //     circle(kp.x, kp.y, 10);
    // });
    // if (pinching_right_now) {
    circle(hand["index_finger_tip"]["x"], hand["index_finger_tip"]["y"], 25);

    appState.handPositions[i] = [
        hand["index_finger_tip"]["x"],
        hand["index_finger_tip"]["y"],
    ];
    // }
}
