import { IconVolumeUp } from "../../icons/svg"; // Tự tạo icon nếu chưa có

import AbstractButton, { IProps } from "./AbstractButton";

/**
 * A button for toggling the speaker (audio output device).
 */
export default class BaseSpeakerToggleButton<P extends IProps, S = any> extends AbstractButton<P, S> {
    override icon = IconVolumeUp;

    /**
     * Toggles the audio output device between speaker and earpiece/bluetooth.
     */
    override _handleClick() {
        this._setAudioSpeaker(!this._isAudioSpeaker());
    }

    /**
     * Return true if speaker is currently active.
     *
     * @protected
     * @returns {boolean}
     */
    override _isToggled() {
        // Optional: implement logic to return whether speaker is active.
        // Jitsi doesn't expose this directly, so return `false` or use state from redux if integrated.
        return false;
    }

    _isAudioSpeaker() {
        // To be implemented by subclass.
        return false;
    }

    _setAudioSpeaker(_audioSpeaker: boolean) {
        // To be implemented by subclass.
    }
}
