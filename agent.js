class Agent {
    x;
    y;
    vel = { x: 0, y: 0 };
    r;
    clr;
    containsSaveData = false;
    waveType;
    baseFrequency;
    modulatorFrequency;
    envelope;
    i = 0;

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vel.x = random(appState.primitive.frequency);
        this.vel.y = random(appState.primitive.frequency);
        this.clr = generateRandomColour();
        this.r = 30;
        this.envelope = null;
    }
    update() {
        let angle;
        let speed;
        this.r = 30;

        if (this.containsSaveData) {
            // animate according to what is saved in it, but move it less
            if (this.waveType === "primitive") {
                angle = map(this.baseFrequency, 0, 200, 0, TWO_PI);
                speed = map(this.baseFrequency, 0, 200, 1, 5);
                this.vel.x = random(-angle, angle);
                this.vel.y = random(-speed, speed);
                this.x += 1 * this.vel.x;
                this.y += 1 * this.vel.y;
                if (this.x < 100 || this.x > width - 100) {
                    this.x = constrain(this.x, 100, width - 100);
                    this.vel.x *= -1;
                }
                if (this.y < 100 || this.y > height - 100) {
                    this.y = constrain(this.y, 100, height - 100);
                    this.vel.y *= -1;
                }
                return;
            } else if (this.waveType === "am" || this.waveType === "fm") {
                let angle = map(this.baseFrequency, 0, 200, 0, TWO_PI);
                let speed = map(this.modulatorFrequency, 0, 20, 1, 5);
                this.vel.x = random(-angle, angle);
                this.vel.y = random(-speed, speed);
                this.x += 1 * this.vel.x;
                this.y += 1 * this.vel.y;
                if (this.x < 100 || this.x > width - 100) {
                    this.x = constrain(this.x, 100, width - 100);
                    this.vel.x *= -1;
                }
                if (this.y < 100 || this.y > height - 100) {
                    this.y = constrain(this.y, 100, height - 100);
                    this.vel.y *= -1;
                }
                return;
            }
            this.r = this.envelope[this.i] * 30;
            this.i = (this.i + 1) % this.envelope.length;
            return;
        }
        switch (appState.currentStage) {
            case 1: // do something random here
                angle = map(appState.primitive.frequency, 0, 200, 0, TWO_PI);
                speed = map(appState.primitive.frequency, 0, 200, 1, 5);
                this.vel.x = random(-angle, angle);
                this.vel.y = random(-speed, speed);
                this.x += 2 * this.vel.x;
                this.y += 2 * this.vel.y;
                if (this.x < 100 || this.x > width - 100) {
                    this.x = constrain(this.x, 100, width - 100);
                    this.vel.x *= -1;
                }
                if (this.y < 100 || this.y > height - 100) {
                    this.y = constrain(this.y, 100, height - 100);
                    this.vel.y *= -1;
                }
                break;
            case 2: // match the primitive waveform here
                angle = map(appState.primitive.frequency, 0, 200, 0, TWO_PI);
                speed = map(appState.primitive.frequency, 0, 200, 1, 5);
                this.vel.x = random(-angle, angle);
                this.vel.y = random(-speed, speed);
                this.x += 2 * this.vel.x;
                this.y += 2 * this.vel.y;
                if (this.x < 100 || this.x > width - 100) {
                    this.x = constrain(this.x, 100, width - 100);
                    this.vel.x *= -1;
                }
                if (this.y < 100 || this.y > height - 100) {
                    this.y = constrain(this.y, 100, height - 100);
                    this.vel.y *= -1;
                }
                break;
            case 3: // match am or fm waveform here
                angle = map(appState.primitive.frequency, 0, 200, 0, TWO_PI);
                speed = map(appState.primitive.frequency, 0, 200, 1, 5);
                this.vel.x = random(-angle, angle);
                this.vel.y = random(-speed, speed);
                this.x += 2 * this.vel.x;
                this.y += 2 * this.vel.y;
                // Bounce off edges
                if (this.x < 100 || this.x > width - 100) {
                    this.x = constrain(this.x, 100, width - 100);
                    this.vel.x *= -1;
                }
                if (this.y < 100 || this.y > height - 100) {
                    this.y = constrain(this.y, 100, height - 100);
                    this.vel.y *= -1;
                }
                if (appState.selectedSubMenu === "am") {
                    let angle = map(
                        appState.modifications.am.primitiveFrequency,
                        0,
                        200,
                        0,
                        TWO_PI
                    );
                    let speed = map(
                        appState.modifications.am.frequency,
                        0,
                        20,
                        1,
                        5
                    );
                    this.vel.x = random(-angle, angle);
                    this.vel.y = random(-speed, speed);
                    this.x += 4 * this.vel.x;
                    this.y += 4 * this.vel.y;
                    if (this.x < 100 || this.x > width - 100) {
                        this.x = constrain(this.x, 100, width - 100);
                        this.vel.x *= -1;
                    }
                    if (this.y < 100 || this.y > height - 100) {
                        this.y = constrain(this.y, 100, height - 100);
                        this.vel.y *= -1;
                    }
                    break;
                } else if (appState.selectedSubMenu === "fm") {
                    let angle = map(
                        appState.modifications.fm.primitiveFrequency,
                        0,
                        200,
                        0,
                        TWO_PI
                    );
                    let speed = map(
                        appState.modifications.fm.frequency,
                        0,
                        20,
                        1,
                        5
                    );
                    this.vel.x = random(-angle, angle);
                    this.vel.y = random(-speed, speed);
                    this.x += 2 * this.vel.x;
                    this.y += 2 * this.vel.y;
                    if (this.x < 100 || this.x > width - 100) {
                        this.x = constrain(this.x, 100, width - 100);
                        this.vel.x *= -1;
                    }
                    if (this.y < 100 || this.y > height - 100) {
                        this.y = constrain(this.y, 100, height - 100);
                        this.vel.y *= -1;
                    }
                    break;
                }
                break;
            case 4:
                this.r = envelopeNode.gain.value * 30;
                switch (appState.envelopeWave) {
                    case "primitive":
                        // replicate the primitive visualization
                        angle = map(
                            appState.primitive.frequency,
                            0,
                            200,
                            0,
                            TWO_PI
                        );
                        speed = map(appState.primitive.frequency, 0, 200, 1, 5);
                        this.vel.x = random(-angle, angle);
                        this.vel.y = random(-speed, speed);
                        this.x += 2 * this.vel.x;
                        this.y += 2 * this.vel.y;
                        if (this.x < 100 || this.x > width - 100) {
                            this.x = constrain(this.x, 100, width - 100);
                            this.vel.x *= -1;
                        }
                        if (this.y < 100 || this.y > height - 100) {
                            this.y = constrain(this.y, 100, height - 100);
                            this.vel.y *= -1;
                        }
                        break;
                    case "fm":
                        // replicate the fm visualization
                        angle = map(
                            appState.modifications.fm.primitiveFrequency,
                            0,
                            200,
                            0,
                            TWO_PI
                        );
                        speed = map(
                            appState.modifications.fm.frequency,
                            0,
                            20,
                            1,
                            5
                        );
                        this.vel.x = random(-angle, angle);
                        this.vel.y = random(-speed, speed);
                        this.x += 2 * this.vel.x;
                        this.y += 2 * this.vel.y;
                        if (this.x < 100 || this.x > width - 100) {
                            this.x = constrain(this.x, 100, width - 100);
                            this.vel.x *= -1;
                        }
                        if (this.y < 100 || this.y > height - 100) {
                            this.y = constrain(this.y, 100, height - 100);
                            this.vel.y *= -1;
                        }
                        break;
                    case "am":
                        // replicate the am visualization
                        angle = map(
                            appState.modifications.am.primitiveFrequency,
                            0,
                            200,
                            0,
                            TWO_PI
                        );
                        speed = map(
                            appState.modifications.am.frequency,
                            0,
                            20,
                            1,
                            5
                        );
                        this.vel.x = random(-angle, angle);
                        this.vel.y = random(-speed, speed);
                        this.x += 2 * this.vel.x;
                        this.y += 2 * this.vel.y;
                        if (this.x < 100 || this.x > width - 100) {
                            this.x = constrain(this.x, 100, width - 100);
                            this.vel.x *= -1;
                        }
                        if (this.y < 100 || this.y > height - 100) {
                            this.y = constrain(this.y, 100, height - 100);
                            this.vel.y *= -1;
                        }
                        break;
                }
                break;
        }
    }

    display() {
        fill(this.clr);
        strokeWeight(2);
        if (this.containsSaveData) stroke(255);
        else stroke(0);
        if (this.containsSaveData) {
            ellipse(this.x, this.y, 1.75 * this.r * this.envelope[this.i]);
            this.i = (this.i + 1) % this.envelope.length;
        } else ellipse(this.x, this.y, this.r);
        strokeWeight(1);
    }
}

function generateRandomColour() {
    switch (appState.targetVibration) {
        case "happy":
            return "rgba(255, 100, 100, 0.4)";
        case "sad":
            return "rgba(255, 255, 100, 0.4)";
        case "agitated":
            return "rgba(255, 100, 100, 0.4)";
        case "wobble":
            return "rgba(100, 255, 255, 0.4)";
        case "ascending":
            return "rgba(255, 100, 100, 0.4)";
        case "descending":
            return "rgba(100, 100, 255, 0.4)";
        case "relaxed":
            return "rgba(100, 255, 100, 0.4)";
        case "tick":
            return "rgba(100, 100, 255, 0.4)";
    }
}
