import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt


RATE = 32000
OUTPUT = Path(__file__).resolve().parents[1] / 'battle3d/unity/audio'


def render(name, seconds, layers, partials, seed):
    random = np.random.default_rng(seed)
    time = np.arange(int(RATE * seconds)) / RATE
    mix = np.zeros_like(time)
    for start, attack, decay, low, high, level in layers:
        age = np.maximum(0, time - start)
        signal = sosfilt(butter(2, [low, high], btype='bandpass', fs=RATE, output='sos'), random.normal(size=len(time)))
        mix += signal * (1-np.exp(-age/attack)) * np.exp(-age/decay) * level
    for start, onset, tail, frequency, pitch_bend, level in partials:
        age = np.maximum(0, time - start)
        phase = frequency*age + pitch_bend*.065*(1-np.exp(-age/.065))
        mix += np.sin(2*np.pi*phase) * (1-np.exp(-age/onset)) * np.exp(-age/tail) * level
    direct = mix.copy()
    for delay, level in ((.039,.13),(.078,.10),(.139,.065),(.214,.038)):
        offset = int(RATE * delay)
        mix[offset:] += direct[:-offset] * level
    mix *= np.minimum(1, (seconds-time)/.055)
    samples = np.round(24575 * mix / max(1e-9, np.max(abs(mix)))).astype('<i2')
    with wave.open(str(OUTPUT / (name + '.wav')), 'wb') as output:
        output.setparams((1,2,RATE,0,'NONE','not compressed'))
        output.writeframes(samples.tobytes())


if __name__ == '__main__':
    OUTPUT.mkdir(exist_ok=True)
    render('cast', .64, [(0,.061,.092,620,3400,.58),(.13,.02,.083,2800,7600,.30)],[(.025,.042,.14,275,-97,.085)],10)
    render('strike', .58, [(0,.001,.028,950,8300,1),(.011,.003,.070,170,1350,.83),(.036,.013,.08,2200,5900,.18)],[(0,.002,.055,66,116,.87),(.007,.001,.038,576,-93,.20)],20)
    render('fracture', .85, [(0,.001,.035,1400,10000,.95),(.015,.004,.105,150,1100,.79),(.08,.002,.048,2500,8400,.47)],[(.004,.003,.09,54,124,1),(.014,.002,.11,934,70,.32),(.039,.003,.17,1457,-61,.12)],30)
    render('sea-open', 1.85, [(0,.14,.35,105,1050,.79),(.22,.048,.21,2100,7300,.34)],[(0,.12,.43,65,45,.84),(.09,.08,.40,212,-37,.22),(.17,.027,.49,633,24,.19),(.28,.018,.43,964,16,.13),(.42,.014,.33,1506,-11,.07)],40)
    render('sea-close', 1.26, [(0,.048,.18,280,2500,.49),(.11,.019,.23,90,790,.73)],[(0,.018,.26,822,180,.22),(.09,.045,.28,173,78,.26),(.12,.029,.28,49,91,.8)],50)
