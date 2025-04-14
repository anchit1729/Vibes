class VibrationRecord {
    constructor(
        waveformType,
        envelopeCurve,
        baseFrequency,
        modulatorFrequency = 0
    ) {
        this.waveformType = waveformType;
        this.envelopeCurve = envelopeCurve;
        this.baseFrequency = baseFrequency;
        this.modulatorFrequency = modulatorFrequency;
    }
}
